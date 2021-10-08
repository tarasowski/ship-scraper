const { chromium } = require("playwright")
const { pipe, asyncPipe, fold, Either, chain, map } = require("fpg")
const AWS = require("aws-sdk")
const dynamodb = new AWS.DynamoDB.DocumentClient({region: process.env.PRODUCTHUNT_REGION})


const PRODUCTHUNT_SHIP_RANKING_DB = process.env.PRODUCTHUNT_SHIP_RANKING_DB

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
    const linkClass = "[class*='styles_link']"
    const imgClass = "[class*='styles_thumbnail']"

    const convertSubscribers = s =>
      Number(s.replace("subscribers", "").trim())

    const title = (html.querySelector(titleClass) || {}).textContent
    const tagline = (html.querySelector(taglineClass) || {}).textContent
    const subscriberCount = ((html.querySelector(subClass) || {}).textContent || "0 subscribers")
    const link = ((html.querySelector(linkClass) || {}).href || "https://")
    const img = ((html.querySelector(imgClass) || {}).src || "https://")
    return {title, tagline, link, img, subscriberCount: convertSubscribers(subscriberCount)}
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

	


const saveJson = data => {
  const fs = require("fs")
  fs.writeFile("./payload.json", JSON.stringify(data), "utf8", (e, ok) => e ? console.log("error", e) : console.log("saved"))
}


const addDate = xs => xs.map(x => ({...x, updateDate: new Date().toISOString().substring(0, 10)}))

const removeNoTitle = data => data.filter(x => x.title)

const hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)


const createParams = data => ({
  RequestItems: {
    [PRODUCTHUNT_SHIP_RANKING_DB]: data.map(x => ({PutRequest: {Item: x}}))
  }
})

const sliceIntoChunks = chunkSize => arr => {
      const res = [];
      for (let i = 0; i < arr.length; i += chunkSize) {
                const chunk = arr.slice(i, i + chunkSize);
                res.push(chunk);
            }
      return res;
}

const saveToDynamoDb = params =>
  dynamodb.batchWrite(params).promise()

const dedupList = xs => 
        xs.filter((v, i, a) => a.findIndex(t => t.hash === v.hash) === i)

const preprocess = asyncPipe([
  addDate,
  removeNoTitle,
  Either.tryCatch(xs => xs.map(x => ({...x, hash: hashCode(x.title)}))),
  map (dedupList),
  map (sliceIntoChunks(25)),
  map (xs => xs.map(createParams)),
  map (xs => xs.map(saveToDynamoDb)),
  fold (e => [], x => x)
])

const scrollBotton = async (page) =>
  await page.evaluate(async () => {
      const nodes = document.querySelectorAll("[class*='styles_item']:last-child")
      const lastNode = (nodes || [])[0] 
      lastNode ? lastNode.scrollIntoView() : void 7
    })


const scrollDown = async (page, j) => {
    let i
    for (i = 0; i < j; i++) {
      console.log(`Scrolling #${i}`)
      await page.waitForTimeout(3000)
      await scrollBotton(page)
    }
    return "Success"
}

const handler = async(event) => {
  try {
    const { page, browser } = await init(true)
    await goToShip("https://www.producthunt.com/upcoming?ref=header_nav", page)
    await scrollDown(page, 20)
    const itemClass = "[class*='styles_item']"
    const ranking = await getItem(page, itemClass)
    await preprocess(ranking)
    await browser.close()
    return "200. Success"
  }
  catch (e) {
    console.log(e)
    return "500. Internal Server Error"
  }

}



if (require.main === module) {
  const assert = require("assert")
  const payload = require("./payload.json")

  const testPreprocess = data =>
    preprocess(data)

  //const processed = preprocess(payload)

  const testHandler = () => 
    handler()
      .then(x => console.log(x))
      .catch(e => console.log(e))

  testHandler()
 

  
  const testConvertSubscribers = s =>
    convertSubscribers(s)

  assert.equal(testConvertSubscribers("58958 subscribers"), 58958)
}
