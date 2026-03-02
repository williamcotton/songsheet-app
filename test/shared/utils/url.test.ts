import { describe, it, expect } from 'vitest'
import { parseQueryString, parseFormBody } from '../../../src/shared/utils/url.ts'

describe('parseQueryString', () => {
  it('returns empty object for empty string', () => {
    expect(parseQueryString('')).toEqual({})
  })

  it('strips leading ? prefix', () => {
    expect(parseQueryString('?foo=bar')).toEqual({ foo: 'bar' })
  })

  it('parses multiple key=value pairs', () => {
    expect(parseQueryString('key=value&key2=value2')).toEqual({
      key: 'value',
      key2: 'value2',
    })
  })

  it('handles encoded special characters', () => {
    expect(parseQueryString('q=hello+world&tag=%23test')).toEqual({
      q: 'hello world',
      tag: '#test',
    })
  })
})

describe('parseFormBody', () => {
  it('parses form-encoded body like a query string', () => {
    expect(parseFormBody('rawText=hello+world&id=test')).toEqual({
      rawText: 'hello world',
      id: 'test',
    })
  })
})
