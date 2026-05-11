exports.index = (req, res) => {
  return res.json({
    success: true,
    data: {
      heroTitle: 'Find the Right Property with Smart Assistance',
      heroSubtitle: 'ElevanLabs helps customers buy, sell, and rent houses, villas, hotels, apartments, and boarding houses with a more transparent and guided process.',
      vision: 'To become a trusted and customer-focused property platform that makes property search, rental, buying, and selling easier for everyone.',
      mission: 'To connect customers with suitable property options through reliable portfolio data, professional assistance, and AI-powered conversations.',
      story: 'The business was built from the common difficulty of finding reliable property information, comparing options, and communicating with agents quickly. ElevanLabs aims to simplify that journey through a clear website, structured portfolio, and automated customer assistance.',
      benefits: [
        'Clear property information',
        'Faster customer response',
        'Assisted property discovery',
        'Support for buying, selling, and renting',
        'WhatsApp follow-up through Fonnte',
        'AI-powered customer service'
      ],
      services: [
        { title: 'Rental Services', description: 'House rental, villa rental, hotel rental, apartment rental, and boarding house assistance.' },
        { title: 'Buying Services', description: 'Helping customers discover property options based on location, budget, area, and facilities.' },
        { title: 'Selling Services', description: 'Helping property owners present and promote properties professionally.' }
      ]
    }
  });
};
