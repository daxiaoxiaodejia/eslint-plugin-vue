/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
'use strict'

// ------------------------------------------------------------------------------
// Requirements
// ------------------------------------------------------------------------------

const utils = require('../utils')
const regexp = require('../utils/regexp')
const casing = require('../utils/casing')

/**
 * @typedef {import('vue-eslint-parser').AST.VAttribute} VAttribute
 * @typedef {import('vue-eslint-parser').AST.VDirective} VDirective
 * @typedef {import('vue-eslint-parser').AST.VElement} VElement
 * @typedef {import('vue-eslint-parser').AST.VIdentifier} VIdentifier
 * @typedef {import('vue-eslint-parser').AST.VExpressionContainer} VExpressionContainer
 * @typedef {import('vue-eslint-parser').AST.VText} VText
 */

/**
 * @typedef { { names: { [tagName in string]: Set<string> }, regexps: { name: RegExp, attrs: Set<string> }[], cache: { [tagName in string]: Set<string> } } } TargetAttrs
 * @typedef { { upper: ElementStack, name: string, attrs: Set<string> } } ElementStack
 */

// ------------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------------

// https://dev.w3.org/html5/html-author/charref
const DEFAULT_WHITELIST = [
  '(',
  ')',
  ',',
  '.',
  '&',
  '+',
  '-',
  '=',
  '*',
  '/',
  '#',
  '%',
  '!',
  '?',
  ':',
  '[',
  ']',
  '{',
  '}',
  '<',
  '>',
  '\u00b7', // "·"
  '\u2022', // "•"
  '\u2010', // "‐"
  '\u2013', // "–"
  '\u2014', // "—"
  '\u2212', // "−"
  '|'
]

const DEFAULT_ATTRIBUTES = {
  '/.+/': [
    'title',
    'aria-label',
    'aria-placeholder',
    'aria-roledescription',
    'aria-valuetext'
  ],
  input: ['placeholder'],
  img: ['alt']
}

const DEFAULT_DIRECTIVES = ['v-text']

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Parse attributes option
 * @returns {TargetAttrs}
 */
function parseTargetAttrs(options) {
  /** @type {TargetAttrs} */
  const result = { names: {}, regexps: [], cache: {} }
  for (const tagName of Object.keys(options)) {
    /** @type { Set<string> } */
    const attrs = new Set(options[tagName])
    if (regexp.isRegExp(tagName)) {
      result.regexps.push({
        name: regexp.toRegExp(tagName),
        attrs
      })
    } else {
      result.names[tagName] = attrs
    }
  }
  return result
}

/**
 * Get a string from given expression container node
 * @param {VExpressionContainer} node
 * @returns { string | null }
 */
function getStringValue(value) {
  const expression = value.expression
  if (!expression) {
    return null
  }
  if (expression.type !== 'Literal') {
    return null
  }
  if (typeof expression.value === 'string') {
    return expression.value
  }
  return null
}

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow the use of bare strings in `<template>`',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/no-bare-strings-in-template.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          whitelist: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          },
          attributes: {
            type: 'object',
            patternProperties: {
              '^(?:\\S+|/.*/[a-z]*)$': {
                type: 'array',
                items: { type: 'string' },
                uniqueItems: true
              }
            },
            additionalProperties: false
          },
          directives: {
            type: 'array',
            items: { type: 'string', pattern: '^v-' },
            uniqueItems: true
          }
        }
      }
    ],
    messages: {
      unexpected: 'Unexpected non-translated string used.',
      unexpectedInAttr: 'Unexpected non-translated string used in `{{attr}}`.'
    }
  },
  create(context) {
    const opts = context.options[0] || {}
    const whitelist = opts.whitelist || DEFAULT_WHITELIST
    const attributes = parseTargetAttrs(opts.attributes || DEFAULT_ATTRIBUTES)
    const directives = opts.directives || DEFAULT_DIRECTIVES

    const whitelistRe = new RegExp(
      whitelist.map((w) => regexp.escape(w)).join('|'),
      'gu'
    )

    /** @type {ElementStack | null} */
    let elementStack = null
    /**
     * Gets the bare string from given string
     * @param {string} str
     */
    function getBareString(str) {
      return str.trim().replace(whitelistRe, '').trim()
    }

    /**
     * Get the attribute to be verified from the element name.
     * @param {string} tagName
     * @returns {Set<string>}
     */
    function getTargetAttrs(tagName) {
      if (attributes.cache[tagName]) {
        return attributes.cache[tagName]
      }
      /** @type {string[]} */
      const result = []
      if (attributes.names[tagName]) {
        result.push(...attributes.names[tagName])
      }
      for (const { name, attrs } of attributes.regexps) {
        name.lastIndex = 0
        if (name.test(tagName)) {
          result.push(...attrs)
        }
      }
      if (casing.isKebabCase(tagName)) {
        result.push(...getTargetAttrs(casing.pascalCase(tagName)))
      }

      return (attributes.cache[tagName] = new Set(result))
    }

    return utils.defineTemplateBodyVisitor(context, {
      /** @param {VText} node */
      VText(node) {
        if (getBareString(node.value)) {
          context.report({
            node,
            messageId: 'unexpected'
          })
        }
      },
      /**
       * @param {VElement} node
       */
      VElement(node) {
        elementStack = {
          upper: elementStack,
          name: node.rawName,
          attrs: getTargetAttrs(node.rawName)
        }
      },
      'VElement:exit'() {
        elementStack = elementStack.upper
      },
      /** @param {VAttribute|VDirective} node */
      VAttribute(node) {
        if (!node.value) {
          return
        }
        if (node.directive === false) {
          const attrs = elementStack.attrs
          if (!attrs.has(node.key.rawName)) {
            return
          }

          if (getBareString(node.value.value)) {
            context.report({
              node: node.value,
              messageId: 'unexpectedInAttr',
              data: {
                attr: node.key.rawName
              }
            })
          }
        } else {
          const directive = `v-${node.key.name.name}`
          if (!directives.includes(directive)) {
            return
          }
          const str = getStringValue(node.value)
          if (str && getBareString(str)) {
            context.report({
              node: node.value,
              messageId: 'unexpectedInAttr',
              data: {
                attr: directive
              }
            })
          }
        }
      }
    })
  }
}
