import warnings
import logging

warnings.filterwarnings('ignore')
logging.getLogger().setLevel(logging.ERROR)

import google_news_scraper

def scrape(config_params):
    """
    Search articles via Google News RSS Search and extract their contents.
    Delegates execution directly to google_news_scraper module.
    """
    return google_news_scraper.scrape(config_params)

if __name__ == "__main__":
    pass
