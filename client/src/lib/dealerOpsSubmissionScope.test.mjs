import assert from 'node:assert/strict'
import { test } from 'node:test'

import { scopePurchaseSubmissionQueryForUser } from './dealerOpsSubmissionScope.mjs'

test('scopes purchase submissions through owned vehicle ids instead of a missing submission user_id column', async () => {
  const submissionQuery = {
    filters: [],
    in(column, values) {
      this.filters.push({ op: 'in', column, values })
      return this
    },
    eq(column, value) {
      this.filters.push({ op: 'eq', column, value })
      return this
    },
  }

  const supabase = {
    from(table) {
      assert.equal(table, 'edc_vehicles')
      return {
        select(columns) {
          assert.equal(columns, 'id')
          return {
            eq(column, value) {
              assert.equal(column, 'user_id')
              assert.equal(value, 'dealer-1')
              return Promise.resolve({
                data: [{ id: 'vehicle-1' }, { id: 'vehicle-2' }, { id: '' }, { id: 'vehicle-1' }],
                error: null,
              })
            },
          }
        },
      }
    },
  }

  const result = await scopePurchaseSubmissionQueryForUser(supabase, submissionQuery, 'dealer-1')

  assert.equal(result.empty, false)
  assert.deepEqual(submissionQuery.filters, [
    { op: 'in', column: 'vehicle_id', values: ['vehicle-1', 'vehicle-2'] },
  ])
})

test('marks scoped purchase submissions empty when the user owns no vehicles', async () => {
  const submissionQuery = {
    in() {
      throw new Error('should not filter an empty vehicle id list')
    },
  }

  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ data: [], error: null })
            },
          }
        },
      }
    },
  }

  const result = await scopePurchaseSubmissionQueryForUser(supabase, submissionQuery, 'dealer-1')

  assert.equal(result.empty, true)
  assert.equal(result.query, submissionQuery)
})
