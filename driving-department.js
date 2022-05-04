//@format
const { exec } = require('child_process');
const cheerio = require('cheerio');
const player = require('play-sound')((opts = {}));
const moment = require('moment');

const {
  SALUTATION,
  NAME,
  BIRTHDAY,
  EMAIL,
  DAYS_IN_ADVANCE,
} = process.env;

const check_dates_curl = () => `PASTE_YOUR_CURL_HERE`;

const pick_date_curl = ({ date, time }, terminId, phpSessionId) => `curl 'https://terminvereinbarung.muenchen.de/fs/termin/index.php?' \
  -H 'Connection: keep-alive' \
  -H 'Cache-Control: max-age=0' \
  -H 'Origin: https://terminvereinbarung.muenchen.de' \
  -H 'Upgrade-Insecure-Requests: 1' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36' \
  -H 'Sec-Fetch-User: ?1' \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'Sec-Fetch-Mode: navigate' \
  -H 'Referer: https://terminvereinbarung.muenchen.de/fs/termin/index.php?' \
  -H 'Accept-Encoding: gzip, deflate, br' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Cookie: PHPSESSID=${phpSessionId}' \
  --data 'step=WEB_APPOINT_NEW_APPOINT&APPOINT=${encodeURIComponent(terminId)}___${date}___${encodeURIComponent(time)}' \
  --compressed`;

const finish_termin_curl = (phpSessionId) => `curl 'https://terminvereinbarung.muenchen.de/fs/termin/index.php?' \
  -H 'Connection: keep-alive' \
  -H 'Cache-Control: max-age=0' \
  -H 'Origin: https://terminvereinbarung.muenchen.de' \
  -H 'Upgrade-Insecure-Requests: 1' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36' \
  -H 'Sec-Fetch-User: ?1' \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'Sec-Fetch-Mode: navigate' \
  -H 'Referer: https://terminvereinbarung.muenchen.de/fs/termin/index.php?' \
  -H 'Accept-Encoding: gzip, deflate, br' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Cookie: PHPSESSID=${phpSessionId}' \
  --data 'step=WEB_APPOINT_SAVE_APPOINT&CONTACT%5Bsalutation%5D=${SALUTATION}&CONTACT%5Bname%5D=${encodeURIComponent(NAME)}&CONTACT%5Bbirthday%5D=${BIRTHDAY}&CONTACT%5Bemail%5D=${encodeURIComponent(EMAIL)}&CONTACT%5Bprivacy%5D=1' \
  --compressed`;

const curl = (args) => {
  return new Promise((resolve, reject) => {
    exec(args, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(stdout);
    });
  });
};

const run = async () => {
  console.log('Running', moment().toISOString());
  const page = await curl(check_dates_curl());
  const $ = cheerio.load(page);
  const script = $('script').get(3);

  const jsonAppoints = JSON.parse(
    Function(`${script.children[0].data}; return jsonAppoints;`).call()
  );

  const { appoints } = Object.values(jsonAppoints)[0];
  let found;
  Object.keys(appoints).forEach((key) => {
    if (found) {
      return;
    }

    const date = moment(key);
    const wish = moment()
      .add(DAYS_IN_ADVANCE, 'days')
      .endOf('day');

    if (date.isBefore(wish) && appoints[key].length !== 0) {
      player.play('beep-01a.mp3');
      found = {
        date: key,
        time: appoints[key][0],
      };
      console.log('found', key, appoints[key][0]);
    }
  });

  if (!found) {
    console.log('Did not find dates');
    return;
  }

  const phpSessionId = check_dates_curl().match(/PHPSESSID=([^']+)/)[1];
  const terminId = Object.keys(jsonAppoints)[0];
  await curl(pick_date_curl(found, terminId, phpSessionId));
  await curl(finish_termin_curl(phpSessionId));

  console.log('got an appointment!', found.date, found.time);
  process.exit();
};

run();
setInterval(async () => {
  try {
    await run();
  } catch (err) {
    console.log('some error happened, trying again');
    console.error(err);
  }
}, 10 * 1000);
