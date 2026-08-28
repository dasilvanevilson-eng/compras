import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [item, setItem] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [preco1, setPreco1] = useState('')
  const [preco2, setPreco2] = useState('')
  const [preco3, setPreco3] = useState('')
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
      password: import.meta.env.VITE_TEST_PASSWORD || 'compras123',
    })

    if (error) alert(error.message)
    else alert('Cadastro criado. Verifique seu email se o Supabase pedir confirmação.')
  }

  async function entrar() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: import.meta.env.VITE_TEST_PASSWORD || 'compras123',
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

    let qty = parseInt(quantidade, 10)
    if (!Number.isFinite(qty) || qty <= 0) qty = 1

    const prices = [preco1, preco2, preco3].map((value) => {
      const normalized = value.replace(',', '.').trim()
      const number = parseFloat(normalized)
      return Number.isFinite(number) && number >= 0 ? number : null
    })

    const [price1, price2, price3] = prices

    const { error } = await supabase.from('compras').insert({
      item,
      quantidade: qty,
      preco_1: price1,
      preco_2: price2,
      preco_3: price3,
      user_id: session.user.id,
    })

    if (error) alert(error.message)
    else {
      setItem('')
      setQuantidade('')
      setPreco1('')
      setPreco2('')
      setPreco3('')
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

  async function alternarCarrinho(compra) {
    const { error } = await supabase
      .from('compras')
      .update({ in_cart: !compra.in_cart })
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
