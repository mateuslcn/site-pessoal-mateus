const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a normal user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log('Navigating to Pinterest profile...');
        await page.goto('https://br.pinterest.com/cflcosta5/_created/', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Waiting 8 seconds for page elements to load...');
        await new Promise(r => setTimeout(r, 8000));

        // Take a screenshot of the page for debugging
        const screenshotPath = 'C:\\Users\\Mateus\\.gemini\\antigravity\\brain\\b67f94a7-2916-409c-a6e6-8038bcc7aa38\\media__pinterest_profile.png';
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log('Screenshot saved to:', screenshotPath);

        // Extract Pin elements
        const pins = await page.evaluate(() => {
            const items = [];
            const imgs = document.querySelectorAll('img');
            imgs.forEach((img, idx) => {
                const src = img.src;
                const alt = img.alt || '';
                
                // Find parent link if any
                let parentAnchor = img.closest('a');
                const href = parentAnchor ? parentAnchor.href : '';

                if (src.includes('pinimg.com')) {
                    items.push({
                        index: idx,
                        src,
                        alt,
                        href
                    });
                }
            });
            return items;
        });

        console.log(`Found ${pins.length} pin images.`);
        fs.writeFileSync('C:\\Users\\Mateus\\.gemini\\antigravity\\brain\\b67f94a7-2916-409c-a6e6-8038bcc7aa38\\scratch\\scraped_pins.json', JSON.stringify(pins, null, 2));
        console.log('Saved to scraped_pins.json');

    } catch (err) {
        console.error('Error during scraping:', err);
    } finally {
        await browser.close();
    }
})();
