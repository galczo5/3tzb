const fs = require('fs');
const program = require('commander');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chromeDriver = require('selenium-webdriver/chrome');

async function loadPage(url, driver) {
    await driver.get(url);
    await hideRodoShit(driver);
}

async function hideRodoShit(driver) {
    await driver.executeScript('$(".rodo-modal").hide()');
    await driver.sleep(500);
}

async function getAuditions(driver) {
    await loadPage('https://www.polskieradio.pl/9,Trojka/30,Audycje', driver);
    let elements = await driver.findElements(By.css('.article a'));

    let result = {};
    for (let i = 0; i < elements.length; i++) {
        let title = await elements[i].getAttribute('title');
        let href = await elements[i].getAttribute('href');
        result[title] = {
            url: href,
            title: title,
            episodes: []
        };
    }

    return Object.values(result);
}

async function getEpisodes(audition, driver) {
    await loadPage(audition.url, driver);
    let goToNextPage = true;
    let pagers = await driver.findElements(By.css('.pager-nav .next'));
    let pagersCount = pagers.length;

    do {
        let episodes = await driver.findElements(By.css('.article a'));
        let currentPage = await getPageNo();
        goToNextPage = await mapEpisodes(episodes);

        let nextBtn = await driver.findElements(By.css('.pager-nav .next a'));

        if (nextBtn.length === 0 || nextBtn.length !== pagersCount) {
            goToNextPage = false;
            continue;
        }

        await nextBtn[nextBtn.length - 1].click();
        await driver.sleep(1000);
        await hideRodoShit(driver);

        let nextPage = await getPageNo();
        let tryCount = 0;

        while (nextPage == currentPage || nextPage == -1) {
            nextPage = await getPageNo();
            await driver.sleep(100);
            tryCount++;

            if (tryCount > 10) {
                console.log('cannot load page ' + (currentPage + 1) + ' of "' + audition.title + '"');
                return;
            }
        }
    }
    while(goToNextPage);

    async function getPageNo() {
        let pageNoElement = await driver.findElements(By.css('.pager-nav a.active'));
        if (pageNoElement.length === 0)
            return -1;

        let result = await pageNoElement[pageNoElement.length - 1].getText();
        return parseInt(result);
    }

    async function mapEpisodes(episodes) {
        for (let j = 0; j < episodes.length; j++) {
            let episode = {
                url: await episodes[j].getAttribute('href'),
                title: await episodes[j].getAttribute('title'),
                files: []
            };

            audition.episodes.push(episode);
        }

        return true;
    }
}

async function getFiles(episode, driver) {
    if (episode.files.length !== 0)
        return;

    await driver.get('view-source:' + episode.url);
    let code = await driver.getPageSource();
    let regex = /source: '[0-9A-Za-z/.\-]*.mp3'/g;
    let matches = code.match(regex);

    if (!matches)
        return;

    episode.files = matches.map(x => 'http:' + x.replace('source: ', '').replace(/'/g, ''));
}

program.option('--output <file>', '[required] output file path')
    .option('--input <file>', 'input file path')
    .option('--headless', 'use chrome headless')
    .option('--force');

program.command('get [auditions,episodes,files]')
    .action(async (val, args) => {
        const options = new chromeDriver.Options();
        options.addArguments('disable-gpu');
        options.addArguments('--blink-settings=imagesEnabled=false');
        options.addArguments("--proxy-server='direct://'");
        options.addArguments("--proxy-bypass-list=*");

        if (val == 'auditions') {
            options.addArguments('--disable-javascript');
            let driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            let result = await getAuditions(driver);

            console.log('Auditions found:');
            result.forEach(a => console.log('- ' + a.title));
            console.log('--');
            console.log('Output will be saved in file: ' + program.output);

            fs.writeFileSync(program.output, JSON.stringify(result, null, 2));
        }

        else if (val == 'episodes') {
            let driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            let fileString = fs.readFileSync(program.input, 'utf8');
            let result = JSON.parse(fileString);

            for (let i = 0; i < result.length; i++) {
                try {
                    if (program.force)
                        result[i].episodes = [];
                    await getEpisodes(result[i], driver);
                }
                catch(e) {
                    console.log('critical error while getting episodes of "' + result[i].title + '"');
                    console.log(e);
                }
            }

            console.log('Episodes found:');
            result.forEach(a => console.log('- ' + a.title + ' - ' + a.episodes.length + ' episodes'));
            console.log('Output will be saved in file: ' + program.output);

            fs.writeFileSync(program.output, JSON.stringify(result, null, 2));
        }

        else if (val == 'files') {
            options.addArguments('--disable-javascript');
            let driver = await new Builder()
                .forBrowser('chrome')
                .setChromeOptions(options)
                .build();

            let fileString = fs.readFileSync(program.input, 'utf8');
            let result = JSON.parse(fileString);

            let fileCount = {};
            for (let i = 0; i < result.length; i++) {
                fileCount[result[i].title] = 0;
                for (let j = 0; j < result[i].episodes.length; j++) {
                    if (program.force)
                        result[i].episodes[j].files = [];

                    await getFiles(result[i].episodes[j], driver);
                    fileCount[result[i].title] += result[i].episodes[j].files.length;
                }
            }

            console.log('Files found:');
            for (let a in fileCount)
                console.log('- ' + a + ' - ' + fileCount[a] + ' files');

            console.log('Output will be saved in file: ' + program.output);

            fs.writeFileSync(program.output, JSON.stringify(result, null, 2));
        }

    });

program.parse(process.argv);
