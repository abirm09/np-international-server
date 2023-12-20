const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const port = 3000;
require("dotenv").config();
const jwt = require("jsonwebtoken");
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
};

const cors = require("cors");
app.use(cors(corsConfig));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@np-international-bd.yxxj47h.mongodb.net/`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    client.connect();
    const database = client.db("npinternational");
    const productCollecction = database.collection("products");
    const categoryCollection = database.collection("category");
    const activityCollection = database.collection("activity");
    const usersCollection = database.collection("users");

    //middleware

    const verifyJwt = async (req, res, next) => {
      const bearerToken = req.headers.authorization;
      if (!bearerToken) {
        return res.status(401).send({ message: "Unauthorized" });
      }
      const token = bearerToken.split(" ")[1];
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        async (err, decoded) => {
          if (err) {
            return res
              .status(403)
              .send({ error: true, message: "Access denied" });
          }
          req.decoded = decoded;
          const result = await usersCollection.findOne({
            uid: decoded.uid,
          });
          if (result && result?.role === "admin") {
            req.user = result;
            next();
          } else {
            return res
              .status(403)
              .send({ error: true, message: "Access denied" });
          }
        }
      );
    };
    const isAdmin = async (req, res, next) => {
      const result = await usersCollection.findOne({ uid: req.decoded.uid });
      if (result.role === "admin") {
        next();
      } else {
        return res.status(403).send({ error: true, message: "Access denied" });
      }
    };
    //jwt token
    app.get("/jwt/:uid/:email", (req, res) => {
      const { uid, email } = req.params;
      const token = jwt.sign({ uid, email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "30d",
      });
      res.send({ token });
    });

    //get all products
    app.get("/products", async (req, res) => {
      const result = await productCollecction.find().toArray();
      res.send(result);
    });

    app.get("/hot-products", async (req, res) => {
      const result = await productCollecction
        .find({}, { projection: { title: 1, image: 1, subCategoryName: 1 } })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/allcategories", async (req, res) => {
      const result = await categoryCollection.find({}).toArray();
      res.send(result);
    });

    app.get("/allcategories/:categorySlug", async (req, res) => {
      const categorySlug = req.params.categorySlug;
      const query = { categorySlug: categorySlug };

      const result = await categoryCollection.findOne(query);
      res.send(result);
    });

    app.get("/allproducts/:categoryName/:subCategoryName", async (req, res) => {
      const categoryName = req.params.categoryName;
      const subCategoryName = req.params.subCategoryName;
      const query = {
        categoryName: categoryName,
        subCategoryName: subCategoryName,
      };

      const result = await productCollecction.find(query).toArray();

      res.send(result);
    });
    //get single propducts

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await productCollecction.find(query).toArray();

      res.send(result);
    });

    app.get("/categoryProducts/:categoryName", async (req, res) => {
      const categoryName = req.params.categoryName;
      const query = { categoryName: categoryName };

      const result = await productCollecction.find(query).toArray();

      res.send(result);
    });

    app.post("/products", async (req, res) => {
      const data = req.body;

      const result = await productCollecction.insertOne(data);
      res.send(result);
    });

    //addcategory

    app.post("/addCategory", async (req, res) => {
      const data = req.body;
      const result = await categoryCollection.insertOne(data);
      res.send(result);
    });

    app.put("/addCategory/:id", async (req, res) => {
      const categoryId = req.params.id;
      const newCategory = req.body;

      try {
        const result = await categoryCollection.updateOne(
          { _id: new ObjectId(categoryId) },
          { $push: { subCategories: newCategory } }
        );

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });
    //delete main category
    app.delete("/deleteCategory/:categoryId/", async (req, res) => {
      const categoryId = req.params.categoryId;
      const query = { _id: new ObjectId(categoryId) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    });

    //delete subcategory
    app.delete(
      "/deleteCategory/:categoryId/:subcategorySlug",
      async (req, res) => {
        const categoryId = req.params.categoryId;
        const subcategorySlug = req.params.subcategorySlug;
        try {
          const result = await categoryCollection.updateOne(
            { _id: new ObjectId(categoryId) },
            { $pull: { subCategories: { subcategorySlug: subcategorySlug } } }
          );

          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send("Internal Server Error");
        }
      }
    );

    //Add new activity
    app.post("/add-activity", verifyJwt, async (req, res) => {
      const { title, shortDescription, activityCover, post } = req.body;
      const data = {
        title,
        shortDescription,
        activityCover,
        post,
        addedOn: Date.now(),
      };
      const result = await activityCollection.insertOne(data);
      res.send(result);
    });

    //get all activity
    app.get("/activities", async (req, res) => {
      const result = await activityCollection
        .find({}, { projection: { post: 0 } })
        .toArray();
      res.send(result);
    });
    //delete activity by id
    app.delete("/activities/:id", verifyJwt, async (req, res) => {
      const result = await activityCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    // get activity data by id
    app.get("/activity/:id", async (req, res) => {
      const result = await activityCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // app.get("/create-user/:uid/:email", async (req, res) => {
    //   const { uid, email } = req.params;
    //   const user = {
    //     uid,
    //     email,
    //     role: "admin",
    //   };
    //   const result = await usersCollection.insertOne(user);
    //   res.send(result);
    // });

    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();s
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
