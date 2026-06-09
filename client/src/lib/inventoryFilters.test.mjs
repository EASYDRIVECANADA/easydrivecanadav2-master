import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

function loadTsModule(relativePath) {
  const filename = resolve(import.meta.dirname, relativePath)
  const source = readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const mod = new Module(filename)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(dirname(filename))
  mod._compile(compiled, filename)
  return mod.exports
}

const { filterInventoryVehicles, getVehicleListingBucket, normalizeInventoryCategory } = loadTsModule('./inventoryFilters.ts')

const vehicles = [
  { id: '1', year: 2020, make: 'Tesla', model: 'Model 3', stockNumber: '1010', vin: 'TESLAVIN123', status: 'In Stock', category: 'premier', inventoryType: 'PREMIERE' },
  { id: '2', year: 2022, make: 'Ford', model: 'Escape', stockNumber: 'FLT-9', vin: 'FLEETVIN999', status: 'In Stock', category: 'fleet', inventoryType: 'FLEET' },
  { id: '3', year: 2018, make: 'Honda', model: 'Civic', stockNumber: 'DLR-2', vin: 'DEALERVIN2', status: 'Sold', category: 'dealer', inventoryType: 'DEALER' },
]

test('getVehicleListingBucket normalizes premier and fleet listings', () => {
  assert.equal(getVehicleListingBucket({ category: 'Premiere' }), 'premier')
  assert.equal(getVehicleListingBucket({ inventoryType: 'PREMIERE' }), 'premier')
  assert.equal(getVehicleListingBucket({ inventoryType: 'FLEET' }), 'fleet')
  assert.equal(getVehicleListingBucket({ category: 'Dealer Select' }), 'dealer')
  assert.equal(getVehicleListingBucket({ category: 'dealer_select' }), 'dealer')
  assert.equal(getVehicleListingBucket({ inventoryType: 'DEALER_SELECT' }), 'dealer')
})

test('filterInventoryVehicles switches between all, premier, dealer, and fleet tabs', () => {
  assert.deepEqual(filterInventoryVehicles(vehicles, { categoryTab: '' }).map((v) => v.id), ['1', '2'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { categoryTab: 'premier' }).map((v) => v.id), ['1'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { categoryTab: 'dealer', statusFilter: new Set(['Sold']), statusOptions: ['In Stock', 'Sold'] }).map((v) => v.id), ['3'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { categoryTab: 'fleet' }).map((v) => v.id), ['2'])
})

test('filterInventoryVehicles searches stock, VIN, make, and model', () => {
  assert.deepEqual(filterInventoryVehicles(vehicles, { searchQuery: '1010' }).map((v) => v.id), ['1'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { searchQuery: 'fleetvin' }).map((v) => v.id), ['2'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { searchQuery: 'tesla' }).map((v) => v.id), ['1'])
  assert.deepEqual(filterInventoryVehicles(vehicles, { searchQuery: 'escape' }).map((v) => v.id), ['2'])
})

test('normalizeInventoryCategory keeps dealer select ahead of fleet fallback inventory type', () => {
  assert.equal(
    normalizeInventoryCategory({ categories: 'dealer_select', inventory_type: 'FLEET' }),
    'dealer_select'
  )
})
