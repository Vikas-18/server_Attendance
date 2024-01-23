const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
require("dotenv").config();

const dburl = process.env.DB_URL;

const port = process.env.PORT || 5000;

// Connect to MongoDB
mongoose
  .connect(dburl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB", error);
  });

// Middleware to parse the request body
app.use(cors()); // cors principal so that frontend can connect with backend
app.use(express.json()); // Add this line to parse JSON data

// Define the User and Result models
const User = mongoose.model("User", {
  rollNumber: String,
});

const Result = mongoose.model("Result", {
  rollNumber: String,
  latitude: String,
  longitude: String,
  attendanceCount: { type: Number, default: 0 },
});

const PasswordSchema = mongoose.Schema({
  password: String,
});

const Password = mongoose.model("Password", PasswordSchema);

// Flag to indicate if attendance is accessible
let isAttendanceAccessible = false;

// Function to calculate distance between two sets of coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371; // Radius of the Earth in kilometers

  // Convert latitude and longitude from degrees to radians
  const radLat1 = (Math.PI / 180) * lat1;
  const radLon1 = (Math.PI / 180) * lon1;
  const radLat2 = (Math.PI / 180) * lat2;
  const radLon2 = (Math.PI / 180) * lon2;

  // Calculate the differences between the coordinates
  const deltaLat = radLat2 - radLat1;
  const deltaLon = radLon2 - radLon1;

  // Haversine formula to calculate distance
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) *
      Math.cos(radLat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance in kilometers
  const distance = earthRadius * c;

  return distance;
}

// get API
app.get("/getResults", async (req, res) => {
  try {
    const results = await Result.find(); // Fetch all results

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// post API
app.post("/authenticateTeacher", async (req, res) => {
  const { password } = req.body;

  try {
    const teacherPassword = await Password.findOne({ password });

    if (!teacherPassword) {
      res.status(403).json({
        success: false,
        message:
          "Invalid credentials. Only teachers are allowed to authenticate.",
      });
    } else {
      // Set the flag to indicate attendance is accessible
      isAttendanceAccessible = true;
      res.json({
        success: true,
        message: "Teacher authenticated successfully.",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.get("/teacherAuthenticationStatus", (req, res) => {
  // Send the current status of isAttendanceAccessible
  res.json({ success: isAttendanceAccessible });
});

// POST endpoint to mark attendance with location check
app.post("/markAttendance", async (req, res) => {
  const { rollNumber, latitude, longitude } = req.body;
  const classroomLatitude = 21.2486; // Replace with the actual latitude of the classroom
  const classroomLongitude = 81.6094; // Replace with the actual longitude of the classroom

  try {
    // Check if the user exists
    const user = await User.findOne({ rollNumber });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found.",
      });
    } else {
      // Calculate distance using the calculateDistance function
      const distance = calculateDistance(
        latitude,
        longitude,
        classroomLatitude,
        classroomLongitude
      );

      // Set your threshold distance (adjust as needed)
      const thresholdDistance = 10; // Adjust this value based on your needs

      // Check if the user is within the threshold distance of the classroom
      if (distance <= thresholdDistance) {
        // Find the existing result entry for the user
        const existingResult = await Result.findOne({ rollNumber });

        // If a result entry exists, increment the attendance count
        if (existingResult) {
          existingResult.attendanceCount =
            (existingResult.attendanceCount || 0) + 1;
          await existingResult.save();
        }

        res.json({ success: true, message: "Attendance marked successfully." });
      } else {
        res.status(403).json({
          success: false,
          message: "You are not within the attendance range.",
        });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// Logout endpoint to reset the flag when the teacher logs out
app.post("/logout", (req, res) => {
  // Reset the flag to indicate that attendance is no longer accessible
  isAttendanceAccessible = false;
  res.json({ success: true, message: "Teacher logged out successfully." });
});

// Server listening on port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
