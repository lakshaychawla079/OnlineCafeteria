const express = require('express');
const router = express.Router();

// Route to render the admin_addFood.ejs page
router.get('/admin_addFood', (req, res) => {
    res.render('admin_addFood', { username: req.session ? req.session.username : "Admin" });
});

// Route to handle form submission
router.post('/admin_addFood', (req, res) => {
    const { FoodName, FoodType, FoodCategory, FoodServing, FoodCalories, FoodPrice, FoodRating } = req.body;
    console.log("Received Data:", req.body);
    res.send('Food item added successfully!');
});

module.exports = router;
