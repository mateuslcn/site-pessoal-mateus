const http = require('https');
const fs = require('fs');
const path = require('path');

const images = [
    {
        name: 'atelier_artist.jpg',
        url: 'https://i.pinimg.com/280x280_RS/49/c4/82/49c482ccdcc2ee070a3742407beb735c.jpg'
    },
    {
        name: 'atelier_caravela.jpg',
        url: 'https://i.pinimg.com/736x/50/48/31/5048314e54098749062e1ccc80c6d5b8.jpg'
    },
    {
        name: 'atelier_frida.jpg',
        url: 'https://i.pinimg.com/736x/d5/ff/92/d5ff928f3ca25c53ef6c45b6ab919f5f.jpg'
    },
    {
        name: 'atelier_coqueirinho.jpg',
        url: 'https://i.pinimg.com/736x/0b/01/2d/0b012d5b1b9e0bd2267da50f58fef92d.jpg'
    },
    {
        name: 'atelier_tambaba.jpg',
        url: 'https://i.pinimg.com/736x/19/24/23/192423fd4324d4d517bab5f99188b1b4.jpg'
    },
    {
        name: 'atelier_girassol.jpg',
        url: 'https://i.pinimg.com/736x/e9/59/8e/e9598e56690f99a7275551bdb6da7fff.jpg'
    }
];

const destDir = 'C:\\Users\\Mateus\\.gemini\\antigravity\\scratch\\site-pessoal-mateus\\images';

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        http.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (status code: ${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

(async () => {
    for (const img of images) {
        const destPath = path.join(destDir, img.name);
        console.log(`Downloading ${img.name} from ${img.url}...`);
        try {
            await download(img.url, destPath);
            console.log(`Successfully saved to ${destPath}`);
        } catch (err) {
            console.error(`Error downloading ${img.name}:`, err.message);
        }
    }
})();
