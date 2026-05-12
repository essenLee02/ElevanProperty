const { fallbackProperties, searchProperties } = require('../services/propertyRecommendationService');

exports.index = async (req, res) => {
  const { transactionType, buildingType, location } = req.query;
  const portfolios = await searchProperties({ transactionType, buildingType, location });

  return res.json({
    success: true,
    data: {
      company: {
        title: 'About ElevanLabs Real Estate',
        profile: 'ElevanLabs provides property rental, buying, and selling assistance through a modern website, structured property portfolio, and AI-powered customer communication.',
        rentalServices: 'Rental services include boarding houses, house rentals, villas, hotels, and apartments for daily, monthly, or yearly needs.',
        buyingServices: 'Buying services help customers identify property options based on location, budget, land size, building size, and facilities.',
        sellingServices: 'Selling services help property owners present property information clearly and connect with potential buyers or renters.'
      },
      filters: {
        transactionTypes: ['sale', 'rent', 'purchase'],
        buildingTypes: ['house', 'apartment', 'hotel', 'villa', 'boarding_house', 'shophouse', 'office', 'warehouse', 'others']
      },
      portfolios: portfolios.length ? portfolios : fallbackProperties
    }
  });
};
