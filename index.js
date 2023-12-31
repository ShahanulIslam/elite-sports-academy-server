const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(express.json())


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized Access" })
        }
        req.decoded = decoded;
        next();
    })
}



// console.log(process.env.ACCESS_TOKEN_KEY);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eo2hmpk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {


        const classCollection = client.db("sportsDB").collection("class");
        const usersCollection = client.db("sportsDB").collection("users");
        const selectedClassCollection = client.db("sportsDB").collection("selectedClass")
        const paymentsCollection = client.db("sportsDB").collection("payment")



        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: '2h' });
            res.send({ token })
        })


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "Forbidden Access" })
            }
            next()
        }



        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })


        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "This user Already exist" })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result)
        });


        //  Set Admin Role

        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" }
            res.send(result)
        })


        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // Set Instructor Roll

        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === "instructor" }
            res.send(result)
        })


        app.patch("/users/instructor/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "instructor",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // All Data


        app.get('/alldata', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        });


        app.get('/data', async (req, res) => {
            const result = await classCollection.find({ class_status: "approved" }).sort({ enrolled_class: -1 }).toArray();
            res.send(result);
        });


        app.post("/data", verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await classCollection.insertOne(data);
            res.send(result);
        })




        app.get("/myclass", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { instructor_email: email };

            if (!email) {
                res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "Forbidden Access" })
            }
            console.log(email, query);
            const result = await classCollection.find(query).toArray();
            res.send(result)
        })



        // Selected Class 

        app.post("/selected-class", async (req, res) => {
            const selectedClass = req.body;
            const result = await selectedClassCollection.insertOne(selectedClass);
            res.send(result)
        })


        app.get('/selected-class', async (req, res) => {
            const email = req.query.email;

            const query = { userEmail: email };
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result);
        })


        app.delete("/selected-class/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result);
        })



        // Update Status 
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    class_status: req.body.class_status,
                },
            };
            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // update classCollection by admin feedback

        app.patch("/insertFeedback/:id", async (req, res) => {
            const id = req.params.id;
            const feedback = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback,
                },
            };
            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // payment related api

        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });


        app.post("/paymenthistory", verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            res.send(result);
        });

        app.get("/enrolled-class", async (req, res) => {
            const result = await paymentsCollection.find().sort({ transectionId: -1 }).toArray();
            res.send(result);
        });

        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);









app.get('/', (req, res) => {
    res.send('Elite sports Academy is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})