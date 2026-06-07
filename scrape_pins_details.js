const puppeteer = require('puppeteer');
const fs = require('fs');

const pinUrls = [
    'https://br.pinterest.com/pin/942448659538839482/',
    'https://br.pinterest.com/pin/942448659531586176/',
    'https://br.pinterest.com/pin/942448659531344918/',
    'https://br.pinterest.com/pin/942448659531344650/',
    'https://br.pinterest.com/pin/942448659531343989/'
];

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const results = [];

    for (let i = 0; i < pinUrls.length; i++) {
        const url = pinUrls[i];
        console.log(`Scraping Pin ${i + 1}/${pinUrls.length}: ${url} ...`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
            await new Promise(r => setTimeout(r, 4000));

            // Extract high-res image and text content
            const pinData = await page.evaluate((pinUrl) => {
                // Pinterest Pin page structure:
                // Title is usually inside h1, or inside data-testid="pin-title"
                const titleEl = document.querySelector('h1, [data-testid="pin-title"]');
                const title = titleEl ? titleEl.innerText : '';

                // Description is usually inside data-testid="pin-description" or secondary description containers
                const descEl = document.querySelector('[data-testid="pin-description"], .pin-description');
                const description = descEl ? descEl.innerText : '';

                // Image is usually the main image on the page
                const imgEl = document.querySelector('[data-testid="pin-image"] img, img');
                const imgSrc = imgEl ? imgEl.src : '';

                return {
                    url: pinUrl,
                    title,
                    description,
                    imgSrc
                };
            }, url);

            console.log(`Pin ${i + 1} scraped:`, pinData.title);
            results.push(pinData);

            // Screenshot for debugging
            await page.screenshot({ path: `C:\\Users\\Mateus\\.gemini\\antigravity\\brain\\b67f94a7-2916-409c-a6e6-8038bcc7aa38\\media__pin_${i + 1}.png` });

        } catch (e) {
            console.error(`Failed to scrape Pin ${i + 1}:`, e.message);
            results.push({ url, error: e.message });
        }
    }

    fs.writeFileSync('C:\\Users\\Mateus\\.gemini\\antigravity\\brain\\b67f94a7-2916-409c-a6e6-8038bcc7aa38\\scratch\\scraped_pins_details.json', JSON.stringify(results, null, 2));
    console.log('Saved all pin details to scraped_pins_details.json');

    await browser.close();
})();
