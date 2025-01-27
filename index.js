const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://scholarhub-98ad5.web.app', 'https://scholarhub-98ad5.firebaseapp.com'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

// JCod8jIrZwGh0jis
// scholarHubDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ytced.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zyfftle.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db('scholarHubDB').collection('users')
    const reviewCollection = client.db('scholarHubDB').collection('reviews')
    const noteCollection = client.db('scholarHubDB').collection('notes')
    const sessionCollection = client.db('scholarHubDB').collection('sessions')
    const bookedSessionCollection = client.db('scholarHubDB').collection('bookedSessions')
    const materialCollection = client.db('scholarHubDB').collection('materials')

    // middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorize access' })
        }
        req.decoded = decoded;
        next()
      })
    }

    const verifyTutor = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isTutor = user?.role === 'Tutor'
      if (!isTutor) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'Admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETE, { expiresIn: '1h' })
      res.send({ token })
    })

    // user related api
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/user/student/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let student = false;
      if (user) {
        student = user?.role === 'Student';
      }
      res.send({ student });
    })

    app.get('/user/tutor/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let tutor = false;
      if (user) {
        tutor = user?.role === 'Tutor';
      }
      res.send({ tutor });
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'Admin';
      }
      res.send({ admin });
    })

    app.get('/all-users', verifyToken, verifyAdmin, async (req, res) => {
      const search = req.query.search
      const query = {
        name: { $regex: `${search}`, $options: 'i' }
      }
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/user/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.findOne(query)
      res.send(result)
    })

    app.put('/user/:id', verifyToken, verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateUser = req.body
      const updatedDoc = {
        $set: {
          role: updateUser.role
        }
      }
      const result = await userCollection.updateOne(query, updatedDoc, options)
      res.send(result)
    })

    // tutors related api
    app.get('/tutors', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    // review related api
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })

    app.post('/review', verifyToken, async (req, res) => {
      const review = req.body
      const result = await reviewCollection.insertOne(review)
      res.send(result)
    })

    // notes related api
    app.get('/notes/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const result = await noteCollection.find({ email: email }).toArray()
      res.send(result)
    })

    app.get('/note/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await noteCollection.findOne(query)
      res.send(result)
    })

    app.post('/note', verifyToken, async (req, res) => {
      const note = req.body
      const result = await noteCollection.insertOne(note)
      res.send(result)
    })

    app.put('/note/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const Updatenote = req.body
      const updatedDoc = {
        $set: {
          title: Updatenote.title,
          description: Updatenote.description
        }
      }
      const result = await noteCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })

    app.delete('/note/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await noteCollection.deleteOne(query)
      res.send(result)
    })

    // session related api
    app.get('/allSessions', async (req, res) => {
      const result = await sessionCollection.find().toArray()
      res.send(result)
    })

    app.get('/sessionsCount', async (req, res) => {
      const count = await sessionCollection.countDocuments()
      res.send({ count })
    })

    app.get('/sessions/:tutor_email', verifyToken, verifyTutor, async (req, res) => {
      const size = parseInt(req.query.size)
      const page = parseInt(req.query.page) - 1

      const tutor_email = req.params.tutor_email
      const result = await sessionCollection.find({ tutor_email: tutor_email }).skip(page * size).limit(size).toArray()
      res.send(result)
    })

    app.post('/session', verifyToken, async (req, res) => {
      const session = req.body
      const result = await sessionCollection.insertOne(session)
      res.send(result)
    })

    app.put('/session/:id', verifyToken, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatestatus = req.body
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: updatestatus.status,
          registration_fee: updatestatus.registration_fee,
          reason: updatestatus.reason,
          feedback: updatestatus.feedback
        }
      }
      const result = await sessionCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })

    app.put('/update-session/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const sessionsData = req.body
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          session_title: sessionsData.session_title,
          description: sessionsData.description,
          registration_start_date: sessionsData.registration_start_date,
          registration_end_date: sessionsData.registration_end_date,
          class_start_time: sessionsData.class_start_time,
          class_end_time: sessionsData.class_end_time,
          session_duration: sessionsData.session_duration,
          registration_fee: sessionsData.registration_fee,
          category: sessionsData.category,
          status: sessionsData.status,
        }
      }
      const result = await sessionCollection.updateOne(query, updatedDoc, options)
      res.send(result)
    })

    app.delete('/session/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await sessionCollection.deleteOne(query)
      res.send(result)
    })

    // booked related api
    app.get('/booked-session/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await bookedSessionCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/booked-sesssion', async (req, res) => {
      const bookedSessions = req.body
      const result = await bookedSessionCollection.insertOne(bookedSessions)
      res.send(result)
    })

    // upload materials related api
    app.get('/materials', async(req, res) => {
      const size = parseInt(req.query.size)
      const page = parseInt(req.query.page) - 1

      const result = await materialCollection.find().skip(page * size).limit(size).toArray()
      res.send(result)
    })

    app.get('/materialsCount', async (req, res) => {
      const count = await materialCollection.countDocuments()
      res.send({ count })
    })

    app.get('/materials/:tutor_email', async(req, res) => {
      const tutor_email = req.params.tutor_email
      const query = {tutor_email: tutor_email}
      const result = await materialCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/material/:id', async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = materialCollection.findOne(query)
      res.send(result)
    })
 
    app.post('/upload-materials', verifyToken, verifyTutor, async (req, res) => {
      const materials = req.body
      const result = await materialCollection.insertOne(materials)
      res.send(result)
    })

    app.put('/materials/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id: new ObjectId(id)}
      const materials = req.body
      const options = {upsert: true}
      const updatedDoc = {
        $set: {
          title: materials.title,
          link: materials.link,
          img: materials.img
        }
      }
      const result = await materialCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })

    app.delete('delete-materials/:id', async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await materialCollection.deleteOne(query)
      res.send(result)
    })


    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const registration_fee = req.body.registration_fee
      const registration_feeInCent = parseFloat(registration_fee) * 100
      if (!registration_fee || registration_feeInCent < 1) return
      const { client_secret } = await stripe.paymentIntents.create({
        amount: registration_feeInCent,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      })
      res.send({ clientSecret: client_secret })
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello from ScholarHub Server..')
})

app.listen(port, () => {
  console.log(`Scholar is running on port ${port}`)
})