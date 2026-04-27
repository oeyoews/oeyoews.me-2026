type VscodeEditorTabProps = {
  filename: string
}

export default function VscodeEditorTab({ filename }: VscodeEditorTabProps) {
  return (
    <div className="vscode-editor-tabs">
      <div className="vscode-editor-tab">
        <span className="vscode-editor-tab-dot" />
        <span className="truncate">{filename}</span>
      </div>
    </div>
  )
}
