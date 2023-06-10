const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors')
require('dotenv').config()

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



        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: '2h' });
            res.send({ token })
        })

        app.get("/data", async (req, res) => {
            const cursor = classCollection.find();
            const result = await cursor.toArray()
            res.send(result)
        })


        app.get("/users",  async (req, res) => {
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
        })




        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
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