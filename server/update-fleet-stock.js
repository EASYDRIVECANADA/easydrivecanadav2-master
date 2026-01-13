const { PrismaClient } = require('@prisma/client');

// For production, set DATABASE_URL environment variable before running
// Example: $env:DATABASE_URL="postgresql://..." ; node update-fleet-stock.js
const prisma = new PrismaClient();

async function updateFleetVehicles() {
  try {
    // Get all fleet vehicles ordered by creation date
    const fleetVehicles = await prisma.vehicle.findMany({
      where: { inventoryType: 'FLEET' },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('Found', fleetVehicles.length, 'fleet vehicles');
    console.log('\n--- Updating stock numbers and adding $3000 markup ---\n');
    
    let stockNum = 1000;
    let totalPriceIncrease = 0;
    
    for (const v of fleetVehicles) {
      const newStock = 'F' + stockNum;
      const newPrice = v.price + 3000;
      
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { 
          stockNumber: newStock,
          price: newPrice
        }
      });
      
      console.log(`${v.year} ${v.make} ${v.model} -> Stock#: ${newStock}, Price: $${v.price} -> $${newPrice}`);
      stockNum++;
      totalPriceIncrease += 3000;
    }
    
    console.log('\n✅ Done! Updated', fleetVehicles.length, 'vehicles');
    console.log('Next fleet stock number will be: F' + stockNum);
    console.log('Total price markup applied: $' + totalPriceIncrease.toLocaleString());
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateFleetVehicles();
