import { useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import { app, db, dbId } from './firebase'

// ponytail: throwaway shell. It exists to prove the app builds, deploys and
// reaches the right Firestore database (TASK-2.1). TASK-3 replaces it with the
// real lijst screen and this ping goes with it.
export function App() {
  const [result, setResult] = useState<string>()

  const ping = async () => {
    setResult('bezig…')
    try {
      const ref = await addDoc(collection(db, 'ping'), { at: new Date().toISOString() })
      setResult(`geschreven naar '${dbId}' → ${ref.id}`)
    } catch (e) {
      setResult(`mislukt: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <main style={{ font: "16px/1.5 system-ui, sans-serif", padding: 24, background: '#121310', color: '#F4F1E6', minHeight: '100vh' }}>
      <h1>Streepkeslijst</h1>
      <p>project: {app.options.projectId}</p>
      <p>database: <strong>{dbId}</strong></p>
      <button onClick={ping} style={{ font: 'inherit', padding: '8px 16px' }}>ping Firestore</button>
      {result && <p>{result}</p>}
    </main>
  )
}
