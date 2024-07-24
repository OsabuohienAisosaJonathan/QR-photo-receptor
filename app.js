const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const OAuth2Data = require('./credentials.json');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Google OAuth2 setup
const oAuth2Client = new google.auth.OAuth2(
    OAuth2Data.web.client_id,
    OAuth2Data.web.client_secret,
    OAuth2Data.web.redirect_uris[0]
);

let authed = false;

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/qr', (req, res) => {
    res.render('qr');
});

app.get('/terms', (req, res) => {
    res.render('terms');
});

app.get('/upload', (req, res) => {
    if (!authed) {
        const url = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/drive.file'
        });
        res.redirect(url);
    } else {
        res.render('upload');
    }
});

app.get('/auth/google/callback', (req, res) => {
    const code = req.query.code;
    if (code) {
        oAuth2Client.getToken(code, (err, tokens) => {
            if (err) {
                console.log(err);
                return res.send('Error retrieving access token');
            }
            oAuth2Client.setCredentials(tokens);
            authed = true;
            res.redirect('/upload');
        });
    }
});

app.post('/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.send('No file uploaded');
    }

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const fileMetadata = {
        name: req.file.originalname,
        parents: ['1RSgpXkzrAJ6cp8rQOplWRSFH4rZWlyi3'] 
    };
    const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path)
    };

    drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
    }, (err, file) => {
        if (err) {
            console.error(err);
            return res.send('Error uploading file');
        }
        // Delete the file from local storage after uploading to Google Drive
        fs.unlink(req.file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
        res.redirect('/upload');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
