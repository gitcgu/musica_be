const express = require('express');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { exec } = require('child_process'); // Importe le module exec
const multer = require('multer');

const app = express();
const PORT = 3000;

const DIR_MP3 = '/var/www/html/_allmp3/';
const DIR_MIX = '/var/www/html/PIONEER_REC2/';
const BASE_URL = 'https://musica.zapto.org';

// Définir le chemin du répertoire audio en tant que constante
//const AUDIO_DIRECTORY = path.join(__dirname, '/home/pi/_tmp'); // Changez 'your-audio-directory' selon vos besoins
const AUDIO_DIRECTORY = path.join('/home/pi/_tmp');

// app.use(cors({origin: 'https://musica.zapto.org', credentials: true}));
app.use(cors({origin: 'https://musicaguegan.netlify.app', credentials: true}));
//app.use(cors({origin: 'https://musica.zapto.org/page-protegee.html', credentials: true}));
app.use(express.json());
app.use(session({secret: 'musica-secret-2025', resave: false, saveUninitialized: true, cookie: {secure: true, httpOnly: true, maxAge: 86400000}}));

//
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(FRONTEND_DIR));

const UNIQUE_PASSWORD = 'toto';
//const CHEMIN_SCRIPT_SHELL = path.join('/var/www/html/conv/mon_script.sh'); // Chemin vers votre script
const CHEMIN_SCRIPT_SHELL = path.join('/home/pi/_tmp/mon_script.sh'); // Chemin vers votre script

// /home/pi/_tmp


const upload = multer();

// Route pour afficher le formulaire protégé
app.get('/page-protegee', (req, res) => {
    console.log('OKKKKKKKKKKxxx');
    res.sendFile(path.join(FRONTEND_DIR, 'page-protegee.html'));
    //res.sendFile(path.join('/var/www/html/frontend/page-protegee.html'));

});


// Route pour vérifier le mot de passe et lancer le script shell
app.post('/submit-chiffre', upload.none(), (req, res) => {
    const { chiffre, password } = req.body;
    console.log('Contenu de req.body:', req.body);

     if (password === UNIQUE_PASSWORD) {
        if (isNaN(parseInt(chiffre))) {
          //  return res.status(400).send('Veuillez entrer un chiffre valide.');
        }
       if (chiffre === 'list') {
        // Action à réaliser si chiffre vaut 'list'
        console.log('Action pour le cas où chiffre est list');
        //res.send('Action pour le cas où chiffre est list'); // Réponse au client
        // Récupérer les liens MP3 et MP4
        const mediaLinks = getMediaLinks();
          console.log(`Liens MP3 et MP4 :\n${mediaLinks}`);
        return res.send(`
        <h1>Liens MP3 et MP4</h1>
        ${mediaLinks}
       `);

       }
    else {
        console.log(`Lancement du script shell avec le chiffre : ${chiffre}`);

        // Exécute le script shell en lui passant le chiffre comme argument
        // Assurez-vous que CHEMIN_SCRIPT_SHELL est le chemin correct vers votre script
       exec(`${CHEMIN_SCRIPT_SHELL} ${chiffre}`, (error, stdout, stderr) => {
//en arriere plan
//         exec(`${CHEMIN_SCRIPT_SHELL} ${chiffre} &`, (error, stdout, stderr) => {

            console.log(`demaarrage script`);
            if (error) {
                    console.log('error1');

                console.error(`Erreur d'exécution du script : ${error.message}`);
                return res.status(500).send(`Erreur lors de l'exécution du script : ${error.message}`);
            }
            if (stderr) {
                console.error(`Erreur du script shell : ${stderr}`);
                // Vous pourriez vouloir renvoyer les erreurs stderr au client si pertinent
                // return res.status(500).send(`Erreur du script : ${stderr}`);
            }

            console.log(`Sortie du script shell : ${stdout}`);
            // --- Récupération et filtrage du résultat ---
            let resultatTraite = {};
            const resultatLignes = stdout.split('\n');

            // Recherche de notre marqueur FIN_TRAITEMENT_JSON
            let jsonResultString = null;
            for (const ligne of resultatLignes) {
                if (ligne.startsWith('FIN_TRAITEMENT_JSON:')) {
                    jsonResultString = ligne.substring('FIN_TRAITEMENT_JSON:'.length);
                    break;
                }
            }

            if (jsonResultString) {
                try {
                    resultatTraite = JSON.parse(jsonResultString);
                    // Ici, vous pouvez construire vos liens hypertextes à partir de resultatTraite
                    let liensHtml = '<h2>Résultats :</h2>';
                    if (resultatTraite.lien1 && resultatTraite.texte1) {
                        liensHtml += `<p><a href="${resultatTraite.lien1}">${resultatTraite.texte1}</a></p>`;
                    }
                    if (resultatTraite.lien2 && resultatTraite.texte2) {
                        liensHtml += `<p><a href="${resultatTraite.lien2}">${resultatTraite.texte2}</a></p>`;
                    }
                    // ... ajoutez d'autres liens si votre script en génère plus ...

                    res.send(liensHtml); // Envoie les liens HTML au frontend

                } catch (e) {
                    console.error("Erreur lors du parsing du JSON du script :", e);
                    res.status(500).send("Erreur de formatage du résultat du script.");
                }
            } else {
                // Si le marqueur n'est pas trouvé, on affiche la sortie brute ou un message d'erreur
                console.warn("Marqueur FIN_TRAITEMENT_JSON non trouvé dans la sortie du script.");
                res.send(`Traitement effectué. Sortie brute : <pre>${stdout}</pre>`);
            }
         });
      }
    } else {
        res.status(401).send('Mot de passe incorrect.');
    }


});

// Fonction pour récupérer les fichiers MP3 et MP4
function getMediaLinks() {
    const directory = '/home/pi/_tmp';
    const files = fs.readdirSync(directory);
    let output = '';

    files.forEach(file => {
        if (file.endsWith('.mp3') || file.endsWith('.mp4')) {
            output += `<a href="https://musica.zapto.org/_tmp/${file}">Écouter ${file}</a><br />`;
        }
    });

    return output;
}

function getAllMp3(dir) { return fs.readdirSync(dir).filter(f => f.endsWith('.mp3')); }

app.get('/api/next-song', (req, res) => {
    if (!req.session.playedSongs) req.session.playedSongs = [];
    const allSongs = getAllMp3(DIR_MP3);
    let available = allSongs.filter(s => !req.session.playedSongs.includes(s));
    if (!available.length) { req.session.playedSongs = []; available = allSongs; }
    const song = available[Math.floor(Math.random() * available.length)];
    req.session.playedSongs.push(song);
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const inverse = '#' + (16777215 - parseInt(color.substring(1), 16)).toString(16).padStart(6, '0');
    // res.json({song, songName: song.replace('.mp3', ''), url: `_allmp3/${song}`, cover: `_alljpg/${song}.jpg`, played: req.session.playedSongs.length, total: allSongs.length, color, textColor: inverse});
    res.json({song, songName: song.replace('.mp3', ''), url: `${BASE_URL}/_allmp3/${song}`, cover: `${BASE_URL}/_alljpg/${song}.jpg`, played: req.session.playedSongs.length, total: allSongs.length, color, textColor: inverse});
});

// Route pour afficher le formulaire protégé
app.get('/', (req, res) => {
    console.log('OKKindex');
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Servir les fichiers statiques
app.use('/your-audio-directory', express.static(AUDIO_DIRECTORY));



app.listen(PORT, () => console.log('🎵 API sur :3000'));
