'use strict';

console.log('Checking availability...');

const axios = require('axios');
const _ = require('lodash');
const config = require('config');

const sendSMS = config.get('twilio.enabled');

let twilioClient;
if (sendSMS) {
    const twilio = require('twilio');
    twilioClient = new twilio.RestClient(
        config.get('twilio.sid'),
        config.get('twilio.token')
    );
}

const { skus, groups, subFamilies } = require('./data/products.json');

Promise.all([
    axios.get('https://reserve.cdn-apple.com/US/en_US/reserve/iPhone/stores.json'),
    axios.get('https://reserve.cdn-apple.com/US/en_US/reserve/iPhone/availability.json')
]).then(([{ data: { stores } }, { data: availability }]) => {
    console.log('Got data...');

    stores = _(stores)
        .filter(store => _.includes(config.get('cities'), store.storeCity))
        .value();

    let storeNumbers = _.map(stores, 'storeNumber');
    let storeAvailability = _.pick(availability, storeNumbers);
    let found = new Set();

    Object.keys(storeAvailability).forEach(storeNumber => {
        let storeName = _.find(stores, { storeNumber: storeNumber }).storeName;
        console.log(`Checking ${storeName}...`);

        let availability = storeAvailability[storeNumber];

        Object.keys(availability).forEach(modelNumber => {
            try {
                let {
                    capacity,
                    color,
                    productDescription: name,
                    group_id,
                    subfamily_id
                } = _.find(skus, { part_number: modelNumber } );

                let product = _.find(subFamilies, { subfamily_id: subfamily_id }).product;
                let group = _.find(groups, { group_id: group_id }).name;
                let carrier = group.replace('iPhone GSM ', '').replace('iPhone CDMA ', '');

                if (availability[modelNumber] === 'ALL' &&
                        carrier === config.get('carrier') &&
                        product === config.get('product') &&
                        color === config.get('color') &&
                        capacity === config.get('capacity')
                    ) {
                    console.log('  ', [
                        storeName, product, color, capacity, carrier
                    ]);
                    found.add(storeName);
                }
            } catch (ex) {}
        });
    });

    found = Array.from(found);

    if (found.length) {
        let message = 'The phone you wanted is available at: ' + found.join(', ');
        console.log(message);
        if (sendSMS) {
            twilioClient.messages.create({
                body: message,
                to: config.get('twilio.to'),
                from: config.get('twilio.from')
            }, function(err, message) {
                console.log(message.sid);
            });
        }
    }

    console.log('Done!');
});