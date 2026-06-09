import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [item, setItem] = useState('')
  const [compras, setCompras] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) carregarCompras()
  }, [session])

  async function cadastrar() {
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    })

    if (error) alert(error.message)
    else alert('Cadastro criado. Verifique seu email se o Supabase pedir confirmação.')
  }

  async function entrar() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) alert(error.message)
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  async function carregarCompras() {
    const { data, error } = await supabase
      .from('compras')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) alert(error.message)
    else setCompras(data)
  }

  async function adicionarItem() {
    if (!item.trim()) return

    const { error } = await supabase.from('compras').insert({
      item,
      user_id: session.user.id,
    })

    if (error) alert(error.message)
    else {
      setItem('')
      carregarCompras()
    }
  }

  async function alternarComprado(compra) {
    const { error } = await supabase
      .from('compras')
      .update({ comprado: !compra.comprado })
      .eq('id', compra.id)

    if (error) alert(error.message)
    else carregarCompras()
  }

  async function excluirItem(id) {
    const { error } = await supabase
      .from('compras')
      .delete()
      .eq('id', id)

    if (error) alert(error.message)
    else carregarCompras()
  }

  if (!session) {
    return (
      <div style={{ padding: 30, maxWidth: 400, margin: 'auto' }}>
        <h1>Lista de Compras</h1>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 10 }}
        />

        <input
          placeholder="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 10, padding: 10 }}
        />

        <button onClick={entrar} style={{ marginRight: 10 }}>
          Entrar
        </button>

        <button onClick={cadastrar}>
          Cadastrar
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 30, maxWidth: 500, margin: 'auto' }}>
      <h1>Minha Lista de Compras</h1>

      <p>Logado como: {session.user.email}</p>

      <button onClick={sair}>Sair</button>

      <hr />

      <input
        placeholder="Digite um item"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        style={{ width: '70%', padding: 10 }}
      />

      <button onClick={adicionarItem} style={{ marginLeft: 10 }}>
        Adicionar
      </button>

      <ul>
        {compras.map((compra) => (
          <li key={compra.id} style={{ marginTop: 10 }}>
            <span
              onClick={() => alternarComprado(compra)}
              style={{
                cursor: 'pointer',
                textDecoration: compra.comprado ? 'line-through' : 'none',
              }}
            >
              {compra.item}
            </span>

            <button
              onClick={() => excluirItem(compra.id)}
              style={{ marginLeft: 10 }}
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}