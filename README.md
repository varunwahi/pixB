# pixB

A self hostable no-cost (1000 images a month) reverse image search + text analysis telegram bot. A convenient way to look up things on your mobile screen.

Take a SS, forward to telegram bot, amuse yourself.

Mainly made out of the need for finding context/origin of memes while scrolling on social media :p

--

Reverse image search returns a guess label along with entities present (with accuracy %). Also returns links for pages containing matching image

<img src="/ss/demo_reverse_image_search.jpg" width="300" height="850" alt="Reverse Image Search">

Text analysis is done on both - text present on images and text sent by msg. Also returns entities and a sentiment analysis score
per every block of text. Also contains google calender event link for any dates present and google map search link for any addresses

<img src="/ss/demo_text_entities.jpg" width="289" height="400" alt="Entities">
<img src="/ss/demo_date_1.jpg" width="454" height="300" alt="Date">
<img src="/ss/demo_date_1_calender.jpg" width="300" height="556" alt="Google Calender Event">

List of dominant colors are also returned along with an image containing those colors.

Dockerfile included.

## Prerequisites

1. Telegram bot token - http://core.telegram.org/bots#3-how-do-i-create-a-bot
2. Google Cloud Service Account json key - https://cloud.google.com/iam/docs/creating-managing-service-account-keys
    . The following APIS need to be enabled on that service account
    1. Cloud Vision API
    2. Cloud Natural Language API

These API's have a free tier of 1000 searches a month - https://cloud.google.com/vision/pricing


## Installation

1. Clone repo
2. Rename 'secrets/config.js.template' to 'secrets/config.js' and put in your bot token.
3. 'gcpKey.json' should also be placed in secrets folder.
4. Start by either:
    1. npm start
    2. docker build --tag pixb . && sudo docker run --name pixb -d pixb
