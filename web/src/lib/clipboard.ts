export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      copyWithExecCommand(text)
      return
    }
  }

  copyWithExecCommand(text)
}

function copyWithExecCommand(text: string): void {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  document.body.appendChild(textArea)
  try {
    textArea.select()
    if (!document.execCommand('copy')) throw new Error('Clipboard copy failed')
  } finally {
    document.body.removeChild(textArea)
  }
}
