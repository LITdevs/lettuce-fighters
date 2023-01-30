require("dotenv").config();

const express = require("express");
const app = express();
const port = process.env.PORT || 3773;

const cookieParser = require("cookie-parser");

app.use(cookieParser());
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

import home from "./routes/home";
import api from "./routes/api";
app.use("/", home);
app.use("/api", api);


app.get("*", (req, res) => {
	res.status(418).end();
})

app.listen(port, () => {
	  console.log(`Listening on port ${port}`);
})