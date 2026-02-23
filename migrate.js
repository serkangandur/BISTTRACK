const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const OLD_UID = '0xyLt2Usa9dmgRPmU4WGD862v912';
const NEW_UID = '81lP34YX3uMhiQeTwjxCoEObMDR2';

initializeApp({ projectId: 'studio-2259989271-45253' });
const db = getFirestore();

async function migrate() {
  // Get old portfolios
  const oldPortfolios = await db.collection('users').doc(OLD_UID).collection('portfolios').get();
  
  for (const portfolio of oldPortfolios.docs) {
    const portfolioData = portfolio.data();
    portfolioData.userId = NEW_UID;
    
    // Copy portfolio doc
    await db.collection('users').doc(NEW_UID).collection('portfolios').doc(portfolio.id).set(portfolioData);
    console.log(`Portfolio copied: ${portfolio.id}`);
    
    // Copy stockHoldings
    const holdings = await db.collection('users').doc(OLD_UID).collection('portfolios').doc(portfolio.id).collection('stockHoldings').get();
    
    for (const holding of holdings.docs) {
      const holdingData = holding.data();
      holdingData.userId = NEW_UID;
      await db.collection('users').doc(NEW_UID).collection('portfolios').doc(portfolio.id).collection('stockHoldings').doc(holding.id).set(holdingData);
      console.log(`  Stock copied: ${holding.id}`);
    }
  }
  
  console.log('Migration complete!');
}

migrate().catch(console.error);
