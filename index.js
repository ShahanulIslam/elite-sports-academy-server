const express = require('express')
const app = express()
const port = process.env.PORT || 3000;
const cors = require('cors')
require('dotenv').config()

// Middleware
app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Elite sports Academy is running!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})