process.env.GOOGLE_APPLICATION_CREDENTIALS = './secrets/gcpKey.json'

const vision = require('@google-cloud/vision');
const language = require('@google-cloud/language');

const Fs = require('fs') 
const Path = require('path') 
const axios = require('axios').default
const { createCanvas} = require('canvas')

const config = require('./secrets/config')


async function imageUrl(file_id){

    let filePathUrl = `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${file_id}`

    let image_url = await axios.get(filePathUrl).then(response => {
        let file_path = response.data.result.file_path
        let image_url = `https://api.telegram.org/file/bot${config.botToken}/${file_path}`
        return image_url
    })

    return image_url

}

async function downloadImage(image_url){
    const path = Path.resolve(__dirname, 'images', 'image.jpg')
    const writer = Fs.createWriteStream(path)

    const response = await axios.get(image_url,{
      responseType: 'stream'
    })

    response.data.pipe(writer)
    let result = await new Promise((resolve,reject)=>{

        writer.on('finish',()=>{
            resolve(path)
        })

        writer.on('error',()=>{
            reject("Image could not be downloaded")
        })
    })

    return result

}


async function processImage(image_path){


    let finalResponse = await Promise.allSettled([
        reverseImageSearch(image_path),
        documentTextDetection(image_path),
        dominantColors(image_path)
    ])
    .then(results =>{
        //console.log(results)
        let response = ""
        results.forEach(result => response+=`\n============================\n\n${result.value}`)
        return response
    })

    return finalResponse

}

async function processText(text){
    let data = await Promise.allSettled([
        sentimentAnalysis(text),
        entityAnalysis(text)
    ])
    

    let sentiment = data[0].value

    if(data[0].status == 'rejected'){ //for unsupported languages
        sentiment = {
            score : 'NA',
            magnitude : 'NA'
        }
    }

    let response = "Entity Analysis :\n"

    let entities = data[1].value

    response+=entities+'\n'
    response+=`\n *SA Score : ${sentiment.score}, Mag : ${sentiment.magnitude}*\n`

    return response

}


function reduceLength(array,length){
    if(array.length > length){
        array = array.splice(0,length)
    }
    return array
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

async function dominantColors(image_path){

    let response = "Dominant colors : \n"
    const client = new vision.ImageAnnotatorClient();
    const [result] = await client.imageProperties(image_path)
    let dominantColors = result.imagePropertiesAnnotation.dominantColors.colors
    dominantColors.sort((a,b) => b.score - a.score)
    dominantColors = reduceLength(dominantColors,5)

    let hexColors = []
    dominantColors.forEach(color => {
        let hex = rgbToHex(color.color.red,color.color.green,color.color.blue)
        hexColors.push(hex)
    })

    hexColors.forEach((color,index) => {
        //response+=`${index+1}. ${color}\n`
        response+=`${index+1}. <a href='https://www.google.com/search?q=${encodeURIComponent(color)}'>${color}</a>\n`
    })

    await drawPng(hexColors)

    return response
}

async function reverseImageSearch(image_path){

    let response = ""

    const client = new vision.ImageAnnotatorClient()
    const [result] = await client.webDetection(image_path);
    const webDetection = result.webDetection;
    //console.log(webDetection.pagesWithMatchingImages[0].partialMatchingImages)


    //removing results with empty description
    let finalWebEntities =  webDetection.webEntities.filter(webEntity => webEntity.description.trim())

    if (finalWebEntities.length) {

        finalWebEntities = reduceLength(finalWebEntities,3)
        response += "Web Entities : \n"

        let maxScore = Math.max.apply(null,finalWebEntities.map((webEntity)=>{return webEntity.score}))

        finalWebEntities.forEach((webEntity,index) => {
            let normalizedScore = (webEntity.score - 0)/(maxScore-0)
            let percent = Math.trunc( normalizedScore*100 );
            response+=`${index+1}. ${webEntity.description} ${percent}%\n`
            //response+=`${index+1}. ${webEntity.description}\n`
      });
    }

    if (webDetection.bestGuessLabels.length) {

        webDetection.bestGuessLabels = reduceLength(webDetection.bestGuessLabels,3)

        response += "\n\nBest guess labels : \n"
        webDetection.bestGuessLabels.forEach((label,index) => {
            // console.log(`  Label: ${label.label}`);
            response+=`${index+1}. ${label.label}\n`
      });
    }

    if (webDetection.pagesWithMatchingImages.length) {

        webDetection.pagesWithMatchingImages = reduceLength(webDetection.pagesWithMatchingImages,3)
        
        response += "\n\nPages with Matching Images : \n"

        webDetection.pagesWithMatchingImages.forEach((page,index) => {
            response+=`\n${index+1}. <a href='${page.url}'> ${page.pageTitle}</a>\n`


            // if(page.fullMatchingImages.length){
            //     response += "\n     Full Matching Images : \n"
            //     page.fullMatchingImages = reduceLength(page.fullMatchingImages)
            //     page.fullMatchingImages.forEach((image,index)=>{
            //         response+=`     <a href='${image.url}'> Image ${index+1}</a>\n`
            //     })
            // }

            // if(page.partialMatchingImages.length){
            //     response += "\n     Partial Matching Images : \n"
            //     page.partialMatchingImages = reduceLength(page.partialMatchingImages)
            //     page.partialMatchingImages.forEach((image,index)=>{
            //         response+=`     <a href='${image.url}'> Image ${index+1}</a>\n`
            //     })
            // }
        });
    }

    // if (webDetection.partialMatchingImages.length) {
    //   console.log(
    //     `Partial matches found: ${webDetection.partialMatchingImages.length}`
    //   );
    //   webDetection.partialMatchingImages.forEach(image => {
    //     console.log(`  URL: ${image.url}`);
    //     console.log(`  Score: ${image.score}`);
    //   });
    // }

    return response
}

// async function textDetection(image_path){
//     let response = "Text detection : \n"
//     const client = new vision.ImageAnnotatorClient()
//     const [result] = await client.textDetection(image_path);
//     const detections = result.textAnnotations;
//     if(detections.length){
//         response+=detections[0].description
//     }

//     return response
// }

// textDetection('./images/image.jpg')

async function documentTextDetection(image_path){
    let response = "Document text detection : \n"
    const client = new vision.ImageAnnotatorClient()
    const [result] = await client.documentTextDetection(image_path)
    const fullTextAnnotation = result.fullTextAnnotation;
    if(!fullTextAnnotation){
        return response
    }

    let blockTexts = []

    fullTextAnnotation.pages[0].blocks.forEach((block,index)=>{
        let blockText = ""
        block.paragraphs.forEach(para=>{
            para.words.forEach(word=>{
                blockText +=' '
                word.symbols.forEach(symbol => blockText+=symbol.text)
            })
        })
        blockTexts.push(blockText)

        // response+=blockText+'\n'

    })

    let sentiments =  Promise.allSettled(blockTexts.map(sentimentAnalysis))
    let entities =  Promise.allSettled(blockTexts.map(entityAnalysis))

    let data = await Promise.allSettled([sentiments,entities])

    blockTexts.forEach((text,index) =>{

        let sentiment = data[0].value[index].value

        if(data[0].value[index].status == 'rejected'){ //for unsupported languages
            sentiment = {
                score : 'NA',
                magnitude : 'NA'
            }
        }

        let entities = data[1].value[index].value

        response+=`\nBlock ${index+1} : \n`
        response+=text
        if(entities != "-")
        response+='\n  '+entities+'\n'
        response+=`\n *SA Score : ${sentiment.score}, Mag : ${sentiment.magnitude}*\n`
    })
    //console.log(response)
    return response
}

//documentTextDetection('./images/image.jpg')
async function entityAnalysis(text){
    const client = new language.LanguageServiceClient();
    const document = {
        content: text,
        type: 'PLAIN_TEXT',
      };

      let response = ""
    
      const [result] = await client.analyzeEntities({document: document});
      let index = 0
      if(result.entities.length){
            response+= "\nEntities : \n"

            result.entities.forEach((entity)=>{
                //console.log(entity)

                if(entity.type == "PERSON"){
                    if("wikipedia_url" in entity.metadata){
                    index+=1
                    response+=`\n  ${index}. PERSON - <a href='${entity.metadata.wikipedia_url}'>${entity.name}</a>`
                    }
                }

                if(entity.type == "WORK_OF_ART"){
                    if("wikipedia_url" in entity.metadata){
                    index+=1
                    response+=`\n  ${index}. WORK OF ART - <a href='${entity.metadata.wikipedia_url}'>${entity.name}</a>`
                    }
                }

                if(entity.type == "ORGANIZATION"){
                    if("wikipedia_url" in entity.metadata){
                    index+=1
                    response+=`\n  ${index}. ORGANIZATION - <a href='${entity.metadata.wikipedia_url}'>${entity.name}</a>`
                    }
                }


                if(entity.type == "LOCATION"){
                    if("wikipedia_url" in entity.metadata){
                    index+=1
                    response+=`\n  ${index}. LOCATION - <a href='${entity.metadata.wikipedia_url}'>${entity.name}</a>`
                    }
                }

                if(entity.type == "ADDRESS"){
                    index+=1
                    let mapsLink = `https://maps.google.com/?q=${encodeURIComponent(entity.name)}`
                    response+=`\n  ${index}. ADDRESS - <a href='${mapsLink}'>${entity.name}</a>`
                }

                if(entity.type == "DATE"){
                    index+=1
                    let year = '2020'
                    if ("year" in entity.metadata){
                        year = entity.metadata["year"]
                    }
                    let month = entity.metadata["month"].padStart(2,'0')
                    let day = entity.metadata["day"].padStart(2,'0')
                    let date = `${year}${month}${day}`


                    let calenderLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&details=${encodeURIComponent(text)}&dates=${date}/${date}&text=Event`
                    //https://calendar.google.com/calendar/render?action=TEMPLATE&text=Birthday&dates=20201231T193000Z/20201231T223000Z&details=With%20clowns%20and%20stuff&location=North%20Pole
                    response+=`\n  ${index}. DATE - <a href='${calenderLink}'>${entity.name}</a>`
                }

                // if(entity.type == ""){
                //     response+=`\n${index+1}. PERSON - <a href='${entity.metadata.wikipedia_url}'>${entity.name}</a>\n`
                // }

            })
            if(response == "\nEntities : \n")
            return "-"
            else
            return response

      }
}

async function sentimentAnalysis(text){

    const client = new language.LanguageServiceClient();

    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };

    const [result] = await client.analyzeSentiment({document: document});
    const sentiment = result.documentSentiment;

    let score = Math.round((sentiment.score + Number.EPSILON) * 100)/100
    if(score > 0){
        score = `${Math.abs(score*100)}% +ve`
    }
    else{
        score = `${Math.abs(score*100)}% -ve`
    }

    let response = {
        score : score,
        magnitude : Math.round((sentiment.magnitude + Number.EPSILON) * 100)/100
    }

    return response

}
async function drawPng(colorsArray){

    const canvas = createCanvas(300, 300)
    const ctx = canvas.getContext('2d')

    let y = 0;

    colorsArray.forEach(color =>{
        ctx.fillStyle = color
        ctx.fillRect(0,y,300,60)
        y+=60
    })
    var image = canvas.toDataURL();
    var data = image.replace(/^data:image\/png;base64,/, "");

    //memfs.mkdirpSync("./images");
    //memfs.writeFileSync('./images/dominantColors.png',data,'base64')

    // memfs.writeFileSync('/images/dominantColors.png',data, 'base64');

    Fs.writeFile("./images/dominantColors.png", data, 'base64', function(err) {
        if(err){
            console.log(err);
        }
    });
}

module.exports = {
    imageUrl,
    downloadImage,
    processImage,
    processText
}