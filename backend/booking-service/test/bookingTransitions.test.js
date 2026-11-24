import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransition } from '../src/lib/bookingTransitions.js'

test('permits intended booking lifecycle changes', () => {
  for (const [from, to] of [['requested', 'awaiting_payment'], ['requested', 'rejected'], ['awaiting_payment', 'confirmed'], ['confirmed', 'started'], ['started', 'completed'], ['confirmed', 'cancelled']]) assert.equal(canTransition(from, to), true)
})
test('rejects invalid and terminal booking transitions', () => {
  for (const [from, to] of [['requested', 'completed'], ['completed', 'cancelled'], ['rejected', 'confirmed'], ['started', 'confirmed']]) assert.equal(canTransition(from, to), false)
})
