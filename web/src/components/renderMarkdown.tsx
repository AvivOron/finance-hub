import React from 'react'

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export function renderMarkdown(text: string, lang?: string): React.ReactNode[] {
  const isRtl = lang === 'he'
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  function isTableRow(line: string) {
    return line.trim().startsWith('|') && line.trim().endsWith('|')
  }

  function isSeparatorRow(line: string) {
    return /^\|[\s|:-]+\|$/.test(line.trim())
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      nodes.push(
        <h1 key={i} className="text-lg font-bold text-white mt-6 mb-2 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="text-sm font-semibold text-gray-200 mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      )
      i++
      continue
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="text-base font-semibold text-white mt-6 mb-2 first:mt-0">
          {renderInline(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    if (isTableRow(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      const nonSeparator = tableLines.filter(l => !isSeparatorRow(l))
      if (nonSeparator.length < 1) { i++; continue }

      const [headerRow, ...bodyRows] = nonSeparator
      const parseRow = (row: string) =>
        row.trim().slice(1, -1).split('|').map(cell => cell.trim()).filter(cell => cell !== '')
      const headerCells = parseRow(headerRow)
      if (headerCells.length === 0) { i++; continue }

      nodes.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead>
              <tr>
                {headerCells.map((cell, j) => (
                  <th key={j} className="text-gray-300 font-semibold px-3 py-2 border-b border-indigo-500/20 bg-indigo-500/5 text-start">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => {
                const cells = parseRow(row)
                return (
                  <tr key={ri} className="border-b border-white/5 hover:bg-white/2">
                    {cells.map((cell, j) => (
                      <td key={j} className="text-gray-300 px-3 py-2">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={i} className="space-y-1.5 my-2 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-gray-300">
              <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (line.trim() === '' || line.trim() === '---') {
      i++
      continue
    }

    nodes.push(
      <p key={i} className="text-sm text-gray-300 leading-relaxed my-1">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return nodes
}
