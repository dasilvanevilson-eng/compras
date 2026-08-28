import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const LOCAL_COMPRAS_KEY = 'compras:test-items'
const LOCAL_USER_ID = 'local-test-user'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [item, setItem] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [preco1, setPreco1] = useState('')
  const [preco2, setPreco2] = useState('')
  const [preco3, setPreco3] = useState('')
  const [compras, setCompras] = useState([])
  const [erro, setErro] = useState('')

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
    if (!session) return

    if (session.user.id === LOCAL_USER_ID) {
      const saved = localStorage.getItem(LOCAL_COMPRAS_KEY)
      queueMicrotask(() => {
        setCompras(saved ? JSON.parse(saved) : [])
      })
      return
    }

    async function carregarComprasIniciais() {
      try {
        setErro('')
        const { data, error } = await supabase
          .from('compras')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) setErro(error.message)
        else setCompras(data)
      } catch {
        setErro('Nao foi possivel carregar a lista. Confira a conexao com o Supabase.')
      }
    }

    carregarComprasIniciais()
  }, [session])

  const isLocalSession = session?.user?.id === LOCAL_USER_ID

  function carregarComprasLocais() {
    const saved = localStorage.getItem(LOCAL_COMPRAS_KEY)
    setCompras(saved ? JSON.parse(saved) : [])
  }

  function salvarComprasLocais(nextCompras) {
    localStorage.setItem(LOCAL_COMPRAS_KEY, JSON.stringify(nextCompras))
    setCompras(nextCompras)
  }

  function entrarModoTeste() {
    setSession({
      user: {
        id: LOCAL_USER_ID,
        email: email || 'teste@local',
      },
    })
  }

  async function cadastrar() {
    try {
      setErro('')
      const { error } = await supabase.auth.signUp({
        email,
        password: import.meta.env.VITE_TEST_PASSWORD || 'compras123',
      })

      if (error) setErro(error.message)
      else alert('Cadastro criado. Verifique seu email se o Supabase pedir confirmação.')
    } catch {
      setErro('Supabase indisponivel. Voce entrou em modo teste local.')
      entrarModoTeste()
    }
  }

  async function entrar() {
    try {
      setErro('')
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: import.meta.env.VITE_TEST_PASSWORD || 'compras123',
      })

      if (error) setErro(error.message)
    } catch {
      setErro('Supabase indisponivel. Voce entrou em modo teste local.')
      entrarModoTeste()
    }
  }

  async function sair() {
    if (isLocalSession) {
      setSession(null)
      setCompras([])
      return
    }

    await supabase.auth.signOut()
  }

  async function carregarCompras() {
    if (isLocalSession) {
      carregarComprasLocais()
      return
    }

    try {
      setErro('')
      const { data, error } = await supabase
        .from('compras')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) setErro(error.message)
      else setCompras(data)
    } catch {
      setErro('Nao foi possivel carregar a lista. Confira a conexao com o Supabase.')
    }
  }

  async function adicionarItem() {
    if (!item.trim()) return

    let qty = parseInt(quantidade, 10)
    if (!Number.isFinite(qty) || qty <= 0) qty = 1

    const prices = [preco1, preco2, preco3].map((value) => {
      const normalized = value.replace(',', '.').trim()
      const number = parseFloat(normalized)
      return Number.isFinite(number) && number >= 0 ? number : null
    })

    const [price1, price2, price3] = prices

    if (isLocalSession) {
      salvarComprasLocais([
        {
          id: crypto.randomUUID(),
          item,
          quantidade: qty,
          preco_1: price1,
          preco_2: price2,
          preco_3: price3,
          comprado: false,
          in_cart: false,
          created_at: new Date().toISOString(),
        },
        ...compras,
      ])
      setItem('')
      setQuantidade('')
      setPreco1('')
      setPreco2('')
      setPreco3('')
      return
    }

    try {
      setErro('')
      const { error } = await supabase.from('compras').insert({
        item,
        quantidade: qty,
        preco_1: price1,
        preco_2: price2,
        preco_3: price3,
        user_id: session.user.id,
      })

      if (error) setErro(error.message)
      else {
        setItem('')
        setQuantidade('')
        setPreco1('')
        setPreco2('')
        setPreco3('')
        carregarCompras()
      }
    } catch {
      setErro('Nao foi possivel adicionar o item. Confira a conexao com o Supabase.')
    }
  }

  async function alternarComprado(compra) {
    if (isLocalSession) {
      salvarComprasLocais(
        compras.map((item) =>
          item.id === compra.id ? { ...item, comprado: !item.comprado } : item
        )
      )
      return
    }

    try {
      setErro('')
      const { error } = await supabase
        .from('compras')
        .update({ comprado: !compra.comprado })
        .eq('id', compra.id)

      if (error) setErro(error.message)
      else carregarCompras()
    } catch {
      setErro('Nao foi possivel atualizar o item. Confira a conexao com o Supabase.')
    }
  }

  async function alternarCarrinho(compra) {
    if (isLocalSession) {
      salvarComprasLocais(
        compras.map((item) =>
          item.id === compra.id ? { ...item, in_cart: !item.in_cart } : item
        )
      )
      return
    }

    try {
      setErro('')
      const { error } = await supabase
        .from('compras')
        .update({ in_cart: !compra.in_cart })
        .eq('id', compra.id)

      if (error) setErro(error.message)
      else carregarCompras()
    } catch {
      setErro('Nao foi possivel atualizar o carrinho. Confira a conexao com o Supabase.')
    }
  }

  async function excluirItem(id) {
    if (isLocalSession) {
      salvarComprasLocais(compras.filter((item) => item.id !== id))
      return
    }

    try {
      setErro('')
      const { error } = await supabase
        .from('compras')
        .delete()
        .eq('id', id)

      if (error) setErro(error.message)
      else carregarCompras()
    } catch {
      setErro('Nao foi possivel excluir o item. Confira a conexao com o Supabase.')
    }
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

        {erro && (
          <p style={{ color: '#b00020', marginBottom: 10 }}>
            {erro}
          </p>
        )}

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

      {erro && (
        <p style={{ color: '#b00020', marginTop: 10 }}>
          {erro}
        </p>
      )}

      <hr />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <input
          placeholder="Digite um item"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          style={{ flex: 1, minWidth: 150, padding: 10 }}
        />

        <input
          placeholder="Quantidade"
          type="number"
          min={1}
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          style={{ width: 100, padding: 10 }}
        />

        <input
          placeholder="Preço 1"
          type="number"
          min={0}
          step="0.01"
          value={preco1}
          onChange={(e) => setPreco1(e.target.value)}
          style={{ width: 100, padding: 10 }}
        />

        <input
          placeholder="Preço 2"
          type="number"
          min={0}
          step="0.01"
          value={preco2}
          onChange={(e) => setPreco2(e.target.value)}
          style={{ width: 100, padding: 10 }}
        />

        <input
          placeholder="Preço 3"
          type="number"
          min={0}
          step="0.01"
          value={preco3}
          onChange={(e) => setPreco3(e.target.value)}
          style={{ width: 100, padding: 10 }}
        />

        <button onClick={adicionarItem}>
          Adicionar
        </button>
      </div>

      <ul>
        {compras.map((compra) => {
          const prices = [compra.preco_1, compra.preco_2, compra.preco_3].filter(
            (value) => value != null
          )
          const bestPrice = prices.length ? Math.min(...prices) : null

          return (
            <li key={compra.id} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={compra.in_cart ?? false}
                  onChange={() => alternarCarrinho(compra)}
                />
                No carrinho
              </label>

              <div style={{ flex: 1 }}>
                <span
                  onClick={() => alternarComprado(compra)}
                  style={{
                    cursor: 'pointer',
                    textDecoration: compra.comprado ? 'line-through' : 'none',
                  }}
                >
                  {compra.item}
                  <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                    ({compra.quantidade ?? 1})
                  </span>
                </span>

                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Preços: {compra.preco_1 != null ? `R$ ${Number(compra.preco_1).toFixed(2)}` : '-'} / {compra.preco_2 != null ? `R$ ${Number(compra.preco_2).toFixed(2)}` : '-'} / {compra.preco_3 != null ? `R$ ${Number(compra.preco_3).toFixed(2)}` : '-'}
                  {bestPrice != null && (
                    <span style={{ marginLeft: 12 }}>
                      Melhor: R$ {Number(bestPrice).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => excluirItem(compra.id)}
                style={{ marginLeft: 10 }}
              >
                Excluir
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
