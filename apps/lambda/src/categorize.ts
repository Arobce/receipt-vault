const MERCHANT_KEYWORDS: Record<string, string[]> = {
  Groceries: [
    "costco", "walmart", "safeway", "sobeys", "loblaws", "no frills",
    "superstore", "metro", "whole foods", "trader joe", "kroger",
    "aldi", "save-on", "freshco", "food basics", "grocery",
  ],
  Dining: [
    "mcdonald", "starbucks", "tim horton", "subway", "burger king",
    "wendy", "pizza", "restaurant", "cafe", "coffee", "doordash",
    "uber eats", "skip the dishes", "chipotle", "kfc", "popeye",
    "denny", "ihop", "taco bell", "dunkin",
  ],
  "Gas & Auto": [
    "shell", "esso", "petro-canada", "chevron", "bp", "gas",
    "petroleum", "fuel", "canadian tire", "autozone", "jiffy lube",
    "valvoline", "car wash",
  ],
  Electronics: [
    "best buy", "apple", "amazon", "newegg", "microsoft", "samsung",
    "canada computers", "memory express",
  ],
  Clothing: [
    "h&m", "zara", "gap", "old navy", "nike", "adidas", "uniqlo",
    "winners", "marshalls", "nordstrom", "lululemon",
  ],
  Healthcare: [
    "pharmacy", "shoppers drug", "cvs", "walgreens", "rexall",
    "clinic", "dental", "medical", "hospital", "optom",
  ],
  "Home & Garden": [
    "home depot", "lowes", "lowe's", "ikea", "home hardware",
    "rona", "wayfair", "bed bath",
  ],
  Entertainment: [
    "netflix", "spotify", "cinema", "theatre", "theater", "game",
    "steam", "playstation", "xbox", "nintendo", "ticket",
  ],
  Travel: [
    "airline", "air canada", "westjet", "hotel", "marriott", "hilton",
    "airbnb", "expedia", "booking.com", "uber", "lyft", "taxi",
    "parking", "transit",
  ],
};

export function categorizeMerchant(merchantName: string): string {
  const lower = merchantName.toLowerCase();

  for (const [category, keywords] of Object.entries(MERCHANT_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }

  return "Other";
}
