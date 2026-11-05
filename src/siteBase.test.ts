import { describe, expect, it } from 'vitest'
import { appPath, withBase } from './siteBase'

describe('withBase', () => {
  it('leaves every path unchanged for the default base', () => {
    for (const path of ['/', '/ogren/sozluk', '/ogren/norondan-devreye#lesson-circuit', '/api/local-connectome', '/sw.js'])
      expect(withBase(path, '/')).toBe(path)
  })

  it('puts the base in front of an app path, exactly once', () => {
    expect(withBase('/', '/Circuitiary/')).toBe('/Circuitiary/')
    expect(withBase('/ogren/sozluk', '/Circuitiary/')).toBe('/Circuitiary/ogren/sozluk')
    expect(withBase('/ogren/norondan-devreye#lesson-circuit', '/Circuitiary/')).toBe('/Circuitiary/ogren/norondan-devreye#lesson-circuit')
    expect(withBase('/sw.js', '/a/b/')).toBe('/a/b/sw.js')
  })
})

describe('appPath', () => {
  it('returns the pathname untouched for the default base, including odd ones', () => {
    for (const pathname of ['/', '', '/ogren/sozluk', '/ogren/sozluk/', '/yanlis/adres', '//x'])
      expect(appPath(pathname, '/')).toBe(pathname)
  })

  it('drops the base and keeps the leading slash', () => {
    expect(appPath('/Circuitiary/', '/Circuitiary/')).toBe('/')
    expect(appPath('/Circuitiary', '/Circuitiary/')).toBe('/')
    expect(appPath('/Circuitiary/ogren/sozluk', '/Circuitiary/')).toBe('/ogren/sozluk')
    expect(appPath('/Circuitiary/ogren/sozluk/', '/Circuitiary/')).toBe('/ogren/sozluk/')
    expect(appPath('/a/b/yanlis', '/a/b/')).toBe('/yanlis')
  })

  it('shows a pathname outside the base as it is, so it is never taken for an app path', () => {
    expect(appPath('/', '/Circuitiary/')).toBe('/')
    expect(appPath('/ogren/sozluk', '/Circuitiary/')).toBe('/ogren/sozluk')
    expect(appPath('/CircuitiaryX/ogren', '/Circuitiary/')).toBe('/CircuitiaryX/ogren')
  })

  it('round-trips with withBase', () => {
    for (const path of ['/', '/ogren/sozluk', '/ogren/devre-kur/'])
      expect(appPath(withBase(path, '/Circuitiary/'), '/Circuitiary/')).toBe(path)
  })
})
