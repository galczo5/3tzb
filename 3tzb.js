#!/usr/bin/env node

const fs = require('fs');
const program = require('commander');
const { Builder, By } = require('selenium-webdriver');
const chromeDriver = require('selenium-webdriver/chrome');

const auditionListUrl = 'https://www.polskieradio.pl/9,Trojka/30,Audycje';

async function loadPage(url, driver) {
    await driver.get(url);
    await hideRodoShit(driver);
}

async function hideRodoShit(driver) {
    await driver.executeScript('$(".rodo-modal").hide()');
    await driver.sleep(250);
}

async function getAuditions(driver, filter = null) {
    await loadPage(auditionListUrl, driver);
    let elements = await driver.findElements(By.css('.article a'));

    let result = {};
    for (let i = 0; i < elements.length; i++) {
        let title = await elements[i].getAttribute('title');

        if (filter && !title.toLowerCase().includes(filter.toLowerCase()))
            continue;

        result[title] = {
            url: await elements[i].getAttribute('href'),
            title: title,
            episodes: []
        };
    }

    return Object.values(result);
}

async function getEpisodes(audition, driver, top = -1) {
    await loadPage(audition.url, driver);
    let loadNextPage = true;
    let pagers = await driver.findElements(By.css('.pager-nav .next'));
    let pagersCount = pagers.length;

    do {
        // Find episodes
        let episodes = await driver.findElements(By.css('.article a'));

        if (episodes.length > top)
            episodes = episodes.slice(0, top);

        top = top - episodes.length;
        loadNextPage = await mapEpisodes(episodes);

        if (top <= 0 || !loadNextPage)
            return;

        // Check if there is next page in pager
        let nextBtn = await driver.findElements(By.css('.pager-nav .next a'));
        if (nextBtn.length === 0 || nextBtn.length !== pagersCount)
            return;

        // Go to next page
        let currentPage = await getPageNo();
        await navigateToNextPage(nextBtn[nextBtn.length - 1]);
        loadNextPage = await waitForPageToChange(currentPage);
    }
    while(loadNextPage);

    // Helper functions
    async function navigateToNextPage(btn) {
        await btn.click();
        await driver.sleep(1000);
        await hideRodoShit(driver);
    }

    async function waitForPageToChange(currentPage) {
        let nextPage = await getPageNo();
        let tryCount = 0;

        // Wait some time for next page
        while (nextPage == currentPage || nextPage == -1) {
            nextPage = await getPageNo();
            await driver.sleep(100);
            tryCount++;

            if (tryCount > 10) {
                console.log('cannot load page ' + (currentPage + 1) + ' of "' + audition.title + '"');
                return false;
            }
        }

        return true;
    }

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

            if (audition.episodes.find(e => e.title === episode.title && e.url == episode.url))
                return false;

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
    let matches = code.match(/source: '[0-9A-Za-z/.\-]*.mp3'/g);

    if (!matches)
        return;

    episode.files = matches.map(x => 'http:' + x.replace('source: ', '').replace(/'/g, ''));
}

program.option('--output <absolute_path>', '[required] output file path')
    .option('--input <absolute_path>', 'input file path')
    .option('--headless', 'use chrome in headless mode')
    .option('--force', 'force override of existing data')
    .option('--title <title>', 'filter auditions by title')
    .option('--top <number>', 'get top <number> episodes for each audition');

program.command('get-auditions')
    .description('get list of auditions, can be filtered with `--title` option. ' +
                 'To add audition to existing file use `--input` option')
    .action(async (val, args) => {
        let driver = await getChromeDriver(program.headless);

        let input = [];
        if (program.input)
            input = readInput(program.input);

        let result = await getAuditions(driver, program.title);

        input.forEach(i => {
            if (!result.find(x => x.title === i.title))
                result.push(i);
        });

        console.log('Auditions found:');
        result.forEach(a => console.log('- ' + a.title));
        saveOutput(result, program.output);
    });

program.command('get-episodes')
    .description('get episodes for auditions in file')
    .action(async (val, args) => {
        let driver = await getChromeDriver(program.headless);
        let fileString = fs.readFileSync(program.input, 'utf8');
        let result = readInput(program.input);

        for (let i = 0; i < result.length; i++) {
            if (program.force)
                result[i].episodes = [];

            await getEpisodes(result[i], driver, parseInt(program.top));
        }

        console.log('Episodes found:');
        result.forEach(a => console.log('- ' + a.title + ' - ' + a.episodes.length + ' episodes'));
        saveOutput(result, program.output);
    });

program.command('get-files')
    .description('get files for auditions in file')
    .action(async (val, args) => {
        let driver = await getChromeDriver(program.headless);
        let result = readInput(program.input);

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

        saveOutput(result, program.output);
    });

async function getChromeDriver(headless) {
    const options = new chromeDriver.Options();
    options.addArguments('disable-gpu',
                         '--blink-settings=imagesEnabled=false',
                         "--proxy-server='direct://'",
                         "--proxy-bypass-list=*");

    if (headless)
        options.addArguments('headless');

    return await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
}

function readInput(path) {
    let fileString = fs.readFileSync(path, 'utf8');
    return JSON.parse(fileString);
}

function saveOutput(obj, path) {
    console.log('Output will be saved in file: ' + path);
    fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

program.parse(process.argv);
