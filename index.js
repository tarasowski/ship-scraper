const { chromium } = require("playwright")



const init = async (isHeadless = true) => {
  const browser = await chromium.launch({
    headless: isHeadless,
    timeout: 30000,
    waitUntil: "networkidle"
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36'
  })

  const page = await context.newPage()
  await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
  });
    return {page, browser}
}


const goToShip = async (url, page) => {
  const response = await page.goto(url, {timeout: 25000})
}

const numberOfSubscribers = async (page, subClass) => 
  await page.$$eval(subClass, html => html.map(x => x.textContent))



const getTitles = async (page, subClass) => 
  await page.$$eval(subClass, html => html.map(x => x.textContent))

const getTaglines = async (page, subClass) => 
  await page.$$eval(subClass, html => html.map(x => x.textContent))

const getSubscribers = async (page, subClass) => 
  await page.$$eval(subClass, html => html.map(x => console.log(x) ||  x.textContent ))


const joinLists = (list1, list2, list3) =>
  list1.map((v, i) => ({title: v, tagline: list2[i], subscriberCount: list3[i]}))


const parseHtml = html => {
    const titleClass = "[class*='styles_title']"
    const taglineClass = "[class*='tagline']"
    const subClass = "[class*='subscriberCount']"

    const title = html.querySelector(titleClass).textContent
    const tagline = html.querySelector(taglineClass).textContent
    const subscriberCount = html.querySelector(subClass).textContent
    return {title, tagline, subscriberCount}
}

const convertSubscribers = s =>
      Number(s.replace("subscribers", "").trim())

const getItem = async (page, itemClass) => 
  await page.$$eval(itemClass, html => html.map(html => {
    const titleClass = "[class*='styles_title']"
    const taglineClass = "[class*='tagline']"
    const subClass = "[class*='subscriberCount']"

    const convertSubscribers = s =>
      Number(s.replace("subscribers", "").trim())

    const title = (html.querySelector(titleClass) || {}).textContent
    const tagline = (html.querySelector(taglineClass) || {}).textContent
    const subscriberCount = ((html.querySelector(subClass) || {}).textContent || "0 subscribers")
    return {title, tagline, subscriberCount: convertSubscribers(subscriberCount)}
}))



async function autoScroll(page){
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var counter = 0
      var timer = setInterval(max => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        counter += 1

        if(totalHeight >= scrollHeight && counter === max){
          clearInterval(timer);
          resolve();
        }
      }, 100, 50); // first arg is the speed of scrolling // last element is the duration of scrolling
    });
  });
}


const addDate = xs => xs.map(x => ({...x, date: new Date().toISOString()}))

const handler = async(event) => {
  try {
    const { page, browser } = await init(true)
    const ship = await goToShip("https://www.producthunt.com/upcoming?ref=header_nav", page)
    await page.waitForTimeout(2000)
    await autoScroll(page)
    const item = "[class*='styles_item']"
    const titleClass = "[class*='styles_title']"
    const taglineClass = "[class*='tagline']"
    const subClass = "[class*='subscriberCount']"
    const ranking = await getItem(page, item)
    const rankingWDates = addDate(ranking) 
    console.log(rankingWDates)
    //const titles = await getTitles(page, titleClass)
    //const taglines = await getTaglines(page, taglineClass) 
    //const subscribers = await getSubscribers(page, subClass) 
    //const list = joinLists(titles, taglines, subscribers)
    //console.log(list)
    await browser.close()
  }
  catch (e) {
    console.log(e)
  }

}



if (require.main === module) {
  const assert = require("assert")
  handler()
    .then(x => x)
    .catch(e => console.log(e))
  
  const testConvertSubscribers = s =>
    convertSubscribers(s)

  assert.equal(testConvertSubscribers("58958 subscribers"), 58958)
}
