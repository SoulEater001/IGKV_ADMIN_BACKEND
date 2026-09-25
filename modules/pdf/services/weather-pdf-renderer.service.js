import puppeteer from "puppeteer";

export class WeatherPdfRendererService {

    async render(html) {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        try {
            const page = await browser.newPage();

            await page.setContent(html, {
                waitUntil: 'load'
            });

            const pdf = await page.pdf({
                format: 'A4',
                landscape: false,
                printBackground: true,
                preferCSSPageSize: true,
                margin: {
                    top: '8mm',
                    right: '10mm',
                    bottom: '8mm',
                    left: '10mm'
                }
            });
            
            return Buffer.from(pdf);
        }
        finally {
            await browser.close();
        }
    }
}
