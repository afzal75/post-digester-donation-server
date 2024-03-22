const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("post-digester-donation");
    const userCollection = db.collection("users");
    const donationCollection = db.collection("donations");
    const donorCollection = db.collection("donors");
    const commentCollection = db.collection("comments");
    const testimonialCollection = db.collection("testimonials");
    const volunteerCollection = db.collection("volunteers");
    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await userCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await userCollection.insertOne({ name, email, password: hashedPassword });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await userCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({
        success: true,
        message: "Login successful",
        token,
      });
    });

    // ==============================================================
    // WRITE YOUR CODE HERE

    app.post("/api/v1/donations", async (req, res) => {
      const supply = req.body;
      const result = await donationCollection.insertOne(supply);

      res.status(201).json({
        success: true,
        message: "Donation created successfully",
        result,
      });
    });

    app.get("/api/v1/donations", async (req, res) => {
      const result = await donationCollection.find().toArray();

      res.status(201).json({
        success: true,
        message: "All Donation retrieved successfully",
        result,
      });
    });

    app.get("/api/v1/donations/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log(id);

        const result = await donationCollection.findOne({
          _id: new ObjectId(id), // Corrected ObjectID usage
        });

        if (!result) {
          return res.status(404).json({
            success: false,
            message: "Donation not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Donation fetched successfully",
          result,
        });
      } catch (error) {
        console.error("Error fetching supply:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    });

    app.patch("/api/v1/donations/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const dataToUpdate = req.body;
        const updateObject = {};

        for (const key in dataToUpdate) {
          if (dataToUpdate[key] !== undefined) {
            updateObject[key] = dataToUpdate[key];
          }
        }

        const result = await donationCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateObject },
          { returnOriginal: false, new: true }
        );

        res.status(201).json({
          success: true,
          message: "Donation updated successfully",
          result,
        });
      } catch (error) {
        console.error("Error updating supply:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to update supply" });
      }
    });

    app.delete("/api/v1/donations/:id", async (req, res) => {
      // find into the database
      const id = req.params.id;

      const result = await donationCollection.findOneAndDelete({
        _id: new ObjectId(id),
      });

      res.status(201).json({
        success: true,
        message: "Donation deleted successfully",
        result,
      });
    });

    app.get("/api/v1/statistics", async (req, res) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: "$category",
              totalDonation: { $sum: "$amount" },
              totalItem: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: null,
              totalDonationSum: { $sum: "$totalDonation" },
              statistics: { $push: "$$ROOT" },
            },
          },
        ];

        const result = await donationCollection.aggregate(pipeline).toArray();
        const statisticsInfo = {
          totalDonationSum: result[0]?.totalDonationSum,
          statistics: result[0]?.statistics,
        };
        res.json(statisticsInfo);
      } catch (error) {
        console.log(error);
      }
    });

    //* Donor Data
    app.post("/api/v1/donor", async (req, res) => {
      const { email, name, image, amount } = req.body;

      const existingUser = await donorCollection.findOne({ email });

      if (!existingUser) {
        const result = await donorCollection.insertOne({
          email,
          name,
          image,
          amount,
        });

        return res.json({
          success: true,
          message: "You provided Donation successfully!",
          result,
        });
      } else {
        const previousAmount = existingUser.amount;
        const updatedAmount = previousAmount + amount;

        const data = await donorCollection.updateOne(
          { email: email },
          { $set: { amount: updatedAmount } }
        );

        res.json({
          success: true,
          message: "You provided Donation successfully!",
          updatedDonation: data,
        });
      }
    });

    app.get("/api/v1/donor", async (req, res) => {
      const data = await donorCollection.find({}).toArray();
      res.json({
        success: true,
        message: "successfully retrieve donors!",
        data,
      });
    });

    app.post("/api/v1/comments", async (req, res) => {
      const { comments, email } = req.body;
      const userData = await userCollection.findOne({ email });
      const currentDateTime = new Date().toLocaleString();
      const newComments = {
        email,
        commenterName: userData.name,
        comments,
        commenterImage: userData?.image,
        timestamp: currentDateTime,
      };
      // Insert comments into the database
      const result = await commentCollection.insertOne(newComments);

      res.status(201).json({
        success: true,
        message: "comments added successfully",
        result,
      });
    });

    app.get("/api/v1/comments", async (req, res) => {
      // find into the database
      const result = await commentCollection.find().toArray();

      res.status(201).json({
        success: true,
        message: "Comments fetched successfully",
        result,
      });
    });

    // * testimonial routes

    app.post("/api/v1/testimonial", async (req, res) => {
      const testimonial = req.body;

      // Insert user into the database
      const result = await testimonialCollection.insertOne(testimonial);

      res.status(201).json({
        success: true,
        message: "testimonial added successfully",
        result,
      });
    });

    //volunteer routes
    app.post("/api/v1/volunteer", async (req, res) => {
      const volunteer = req.body;

      // Insert user into the database
      const result = await volunteerCollection.insertOne(volunteer);

      res.status(201).json({
        success: true,
        message: "volunteer added successfully",
        result,
      });
    });

    app.get("/api/v1/volunteer", async (req, res) => {
      const result = await volunteerCollection.find().toArray();

      res.status(201).json({
        success: true,
        message: "volunteer fetched successfully",
        result,
      });
    });

    // ==============================================================

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
