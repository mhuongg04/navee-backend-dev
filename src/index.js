const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const apiRouter = require('./routes/web');
const cors = require("cors");

const { PrismaClient } = require('@prisma/client');
const app = express();
dotenv.config();

//config App

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);
//app.use('api', authRouter);

app.use(apiRouter);

const prisma = new PrismaClient();
prisma.$connect()
    .then(() => {
        console.log("Connected to the database successfully");
    })
    .catch((error) => {
        console.error("Error connecting to the database:", error);
    });

let port = process.env.PORT || 4062;
app.listen(port, () => {
    //callback
    console.log("Backend nodejs is running on " + port);
})

