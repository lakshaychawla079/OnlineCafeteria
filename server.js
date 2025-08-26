const express = require("express");
const mysql = require("mysql");
const session = require("express-session");
const app = express();
const port = 3000;

// ✅ Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Setup Express Session
app.use(session({
    secret: "your_secret_key",  // Change this to a strong secret
    resave: false,
    saveUninitialized: true
}));

// ✅ Set EJS as the template engine
app.set("view engine", "ejs");

// ✅ Serve static files
app.use(express.static("public"));

// ✅ Connect to MySQL Database
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "lakshay",  // Update your MySQL password
    database: "foodorderingwesitedb"
});

db.connect((err) => {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        return;
    }
    console.log("Connected to MySQL database!");
});

// ✅ Homepage Route
app.get("/", (req, res) => res.render("index", { title: "My EJS Page" }));
app.get("/signin", (req, res) => res.render("signin"));
app.get("/signup", (req, res) => res.render("signup"));
app.get("/admin_signin", (req, res) => res.render("admin_signin"));

// *********************************
app.get("/", (req, res) => {
    res.render("homepage", { items: menuItems, username: req.session.username || "Guest" });
});
// *********************************

app.get("/adminHomepage", (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect("/admin_signin"); // Redirect if not logged in
    }

    res.render("adminHomepage", { admin: req.session.admin_name });
});


app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Logout failed.");
        }
        res.redirect("/signin"); // Redirect to signin or homepage after logout
    });
});


app.get('/settings', (req, res) => {
    res.render('settings'); // Make sure 'settings.ejs' exists in your 'views' folder
});




// ✅ Homepage Route (After login)
app.get("/homepage", (req, res) => {
    if (!req.session.username) {
        return res.redirect("/signin");
    }
    
    const menuQuery = "SELECT * FROM menu"; // Adjust based on your table name
    db.query(menuQuery, (menuErr, menuItems) => {
        if (menuErr) {
            console.error("Error fetching menu:", menuErr);
            return res.status(500).send("Error fetching menu.");
        }
        res.render("homepage", { username: req.session.username, items: menuItems });
    });
});





// ✅ Cart Route (Fix req.session.cart & username issue)
app.get("/cart", (req, res) => {
    if (!req.session.cart) {
        req.session.cart = [];  // ✅ Initialize cart if empty
    }

    const item_count = req.session.cart.length;  // ✅ Get the number of items in cart
    const username = req.session.username || "Guest"; // ✅ Use stored username or "Guest"
    const items = req.session.cart;  // ✅ Fetch items from session cart

    res.render("cart", { cartItems: items, item_count, username, items });
});

app.post("/add-to-cart", (req, res) => {
    const { item_id } = req.body;

    if (!req.session.cart) {
        req.session.cart = [];
    }

    const query = "SELECT * FROM menu WHERE item_id = ?";
    db.query(query, [item_id], (err, results) => {
        if (err) {
            console.error("Error fetching item:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length > 0) {
            req.session.cart.push(results[0]);
            res.json({ success: true, cart: req.session.cart });
        } else {
            res.json({ success: false, message: "Item not found" });
        }
    });
});

// ✅ Signup Route (Store in MySQL)
app.post("/signup", (req, res) => {
    const { name, address, email, password, mobile } = req.body;
    
    if (!email.endsWith("@bvicam.in")) {
        return res.send("Registration allowed only for @bvicam.in email addresses.");
      }
      
    const query = "INSERT INTO users (user_name, user_address, user_email, user_password, user_mobileno) VALUES (?, ?, ?, ?, ?)";
    db.query(query, [name, address, email, password, mobile], (err, result) => {
        if (err) {
            console.error("Error inserting user:", err);
            res.status(500).send("Signup Failed!");
        } else {
            console.log("User Registered:", name, email);
            res.send(`Signup Successful for ${name}`);
        }
    });
});

app.get("/myorders", (req, res) => {
    if (!req.session.user_id) {
        return res.redirect("/signin"); // Redirect to login if not authenticated
    }

    const userId = req.session.user_id;

    const query = `
        SELECT o.order_id, o.quantity, o.price, o.datetime, 
               m.item_name, m.item_img
        FROM orders o
        JOIN menu m ON o.item_id = m.item_id
        WHERE o.user_id = ?
        ORDER BY o.datetime DESC`;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching orders:", err);
            return res.status(500).send("Error fetching your orders.");
        }

        res.render("myorders", { username: req.session.username, orders: results });
    });
});

app.post("/checkout", (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.status(400).send("Cart is empty! Please add items before checking out.");
    }

    const username = req.session.username || "Guest"; // Get the current user  
    const cartItems = req.session.cart;

    let total_price = 0;
    cartItems.forEach(item => total_price += item.item_price); // Calculate total price  

    // Store the order in the database (Optional)
    const orderQuery = "INSERT INTO orders (username, total_price) VALUES (?, ?)";
    db.query(orderQuery, [username, total_price], (err, result) => {
        if (err) {
            console.error("Error saving order:", err);
            return res.status(500).send("Error processing order.");
        }

        const order_id = result.insertId;

        // Insert each cart item into `order_items` table (Optional)
        const orderItemsQuery = "INSERT INTO order_items (order_id, item_id, item_name, item_price) VALUES ?";
        const values = cartItems.map(item => [order_id, item.item_id, item.item_name, item.item_price]);

        db.query(orderItemsQuery, [values], (orderErr) => {
            if (orderErr) {
                console.error("Error saving order items:", orderErr);
                return res.status(500).send("Error processing order items.");
            }

            // ✅ Clear the session cart after successful order
            req.session.cart = [];

            // ✅ Redirect to order confirmation page
            res.render("order_confirmation", { username, total_price });
        });
    });
});

app.post("/admin_signin", (req, res) => {
    const { admin_email, admin_password } = req.body;

    console.log("Received Admin Email:", admin_email);
    console.log("Received Admin Password:", admin_password);

    const query = "SELECT * FROM admin WHERE admin_email = ? AND admin_password = ?";
    db.query(query, [admin_email, admin_password], (err, results) => {
        if (err) {
            console.error("Error during admin login:", err);
            return res.status(500).send("Error during login.");
        }

        console.log("Query Result:", results);

        if (results.length > 0) {
            const admin = results[0];

            // ✅ Store admin session
            req.session.admin_name = admin.admin_name;
            req.session.admin_email = admin.admin_email;
            req.session.isAdmin = true;

            console.log("Admin Logged In:", admin.admin_name);
            res.redirect("/adminHomepage"); // ✅ Redirect to Admin Dashboard
        } else {
            console.log("Invalid Credentials Entered!");
            res.render("admin_signin", { error: "Invalid Admin Email or Password!" }); // ✅ Show error
        }
    });
});


// ✅ Signin Route (Authenticate from MySQL)
app.post("/signin", (req, res) => {
    const { email, password } = req.body;

    const query = "SELECT * FROM users WHERE user_email = ? AND user_password = ?";
    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error("Error during login:", err);
            return res.status(500).send("Error during login.");
        }

        if (results.length > 0) {
            const user = results[0];

            // ✅ Store user info in session
            req.session.username = user.user_name;

            // ✅ Fetch menu items from the database
            const menuQuery = "SELECT * FROM menu"; // Adjust based on your table name
            db.query(menuQuery, (menuErr, menuItems) => {
                if (menuErr) {
                    console.error("Error fetching menu:", menuErr);
                    return res.status(500).send("Error fetching menu.");
                }

                res.render("homepage", { username: user.user_name, items: menuItems });
            });
        } else {
            res.send("Invalid Email or Password!");
        }
    });
});


app.get('/admin_addFood', (req, res) => {
    res.render('admin_addFood', { username: req.session.username });
});

// Handle form submission
app.post('/admin_addFood', (req, res) => {
    // Your logic to handle form data
    res.send('Food added successfully!');
});

module.exports = app;


app.get("/admin_view_dispatch_orders", (req, res) => {
    const query = "SELECT * FROM order_dispatch"; // Adjust table name if needed
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching dispatch orders:", err);
            return res.status(500).send("Database Error");
        }

        res.render("admin_view_dispatch_orders", {
            username: req.session.username || "Admin",
            orders: results
        });
    });
});


app.get('/admin_view_dispatch_orders', (req, res) => {
    db.query("SELECT * FROM order_dispatch", (err, results) => {
        if (err) {
            console.error("❌ Database Query Error:", err.sqlMessage);
            return res.status(500).send(`Database Error: ${err.sqlMessage}`);
        }
        console.log("✅ Orders fetched successfully:", results);
        res.render('admin_view_dispatch_orders', { 
            username: req.session?.username || "Admin", 
            orders: results 
        });
    });
});


app.get('/admin_change_price', (req, res) => {
    db.query("SELECT * FROM menu", (err, results) => {
        if (err) {
            console.error("❌ Database Query Error:", err.sqlMessage);
            return res.status(500).send(`Database Error: ${err.sqlMessage}`);
        }
        console.log("✅ Menu items fetched successfully:", results);
        res.render('admin_change_price', { 
            username: req.session?.username || "Admin", 
            items: results  // Changed 'menuItems' to 'items' to match your EJS file
        });
    });
});


app.post('/admin_change_price', async (req, res) => {
    const { item_name, NewFoodPrice } = req.body;

    try {
        await db.query('UPDATE menu SET item_price = ? WHERE item_name = ?', [NewFoodPrice, item_name]);
        res.redirect('/adminHomePage'); // Or wherever you want to go after update
    } catch (error) {
        console.error('Error updating price:', error);
        res.status(500).send('Internal Server Error');
    }
});











// ✅ Start the Server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
