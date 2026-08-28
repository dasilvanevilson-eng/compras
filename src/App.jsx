import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './supabaseClient'

const LOCAL_STATE_KEY = 'compras:intelligent-state'
const LOCAL_USER_ID = 'local-test-user'
const TEST_PASSWORD = import.meta.env.VITE_TEST_PASSWORD || 'compras123'

const DAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

const EMPTY_STATE = {
  supermarkets: [],
  products: [],
  shoppingItems: [],
  quotes: [],
  campaigns: [],
  purchases: [],
}

const SAMPLE_STATE = {
  supermarkets: [
    { id: 'market-sol', name: 'Mercado Sol', region: 'Bairro', created_at: '2026-08-20T09:00:00.000Z' },
    { id: 'assai', name: 'Assai', region: 'Atacado', created_at: '2026-08-20T09:05:00.000Z' },
    { id: 'online', name: 'Online', region: 'Internet', created_at: '2026-08-20T09:10:00.000Z' },
  ],
  products: [
    {
      id: 'arroz-5kg',
      name: 'Arroz 5 kg',
      category: 'Mercearia',
      unit: 'pc',
      last_price: 28.9,
      last_store: 'Assai',
      last_purchase_date: '2026-08-12',
      created_at: '2026-08-20T09:20:00.000Z',
    },
    {
      id: 'feijao-1kg',
      name: 'Feijao carioca 1 kg',
      category: 'Mercearia',
      unit: 'pc',
      last_price: 8.39,
      last_store: 'Assai',
      last_purchase_date: '2026-08-10',
      created_at: '2026-08-20T09:22:00.000Z',
    },
    {
      id: 'sabao-liquido',
      name: 'Sabao liquido',
      category: 'Limpeza',
      unit: 'un',
      last_price: 23.5,
      last_store: 'Mercado Sol',
      last_purchase_date: '2026-08-04',
      created_at: '2026-08-20T09:25:00.000Z',
    },
  ],
  shoppingItems: [
    { id: 'item-arroz', product_id: 'arroz-5kg', quantity: 2, status: 'pending', created_at: '2026-08-28T08:00:00.000Z' },
    { id: 'item-feijao', product_id: 'feijao-1kg', quantity: 4, status: 'pending', created_at: '2026-08-28T08:10:00.000Z' },
    { id: 'item-sabao', product_id: 'sabao-liquido', quantity: 2, status: 'pending', created_at: '2026-08-28T08:20:00.000Z' },
  ],
  quotes: [
    {
      id: 'quote-arroz-1',
      shopping_item_id: 'item-arroz',
      establishment: 'Assai',
      price: 27.9,
      shipping: 0,
      source: 'physical',
      quoted_at: '2026-08-28',
      note: 'Preco de atacado',
    },
    {
      id: 'quote-arroz-2',
      shopping_item_id: 'item-arroz',
      establishment: 'Mercado Sol',
      price: 25.99,
      shipping: 0,
      source: 'physical',
      quoted_at: '2026-08-28',
      note: 'Campanha da semana',
    },
    {
      id: 'quote-feijao-1',
      shopping_item_id: 'item-feijao',
      establishment: 'Mercado Sol',
      price: 7.49,
      shipping: 0,
      source: 'physical',
      quoted_at: '2026-08-28',
      note: 'Oferta de quarta',
    },
    {
      id: 'quote-feijao-2',
      shopping_item_id: 'item-feijao',
      establishment: 'Online',
      price: 6.99,
      shipping: 4.5,
      source: 'online',
      quoted_at: '2026-08-28',
      note: 'Frete proporcional',
    },
  ],
  campaigns: [
    { id: 'camp-sol-horti', supermarket_id: 'market-sol', weekday: 1, category: 'Hortifruti', description: 'Frutas, verduras e legumes com maior giro.', active: true },
    { id: 'camp-assai-mercearia', supermarket_id: 'assai', weekday: 3, category: 'Mercearia', description: 'Arroz, feijao, cafe e oleo costumam compensar.', active: true },
    { id: 'camp-online-limpeza', supermarket_id: 'online', weekday: 5, category: 'Limpeza', description: 'Comparar kits, frete e cashback antes de fechar.', active: true },
  ],
  purchases: [],
}

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const today = () => new Date().toISOString().slice(0, 10)
const normalizeText = (value) => value.trim().replace(/\s+/g, ' ')
const toNumber = (value, fallback = 0) => {
  const number = Number(String(value).replace(',', '.'))
  return Number.isFinite(number) ? number : fallback
}
const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function quoteEffectivePrice(quote) {
  return Number(quote.price || 0) + Number(quote.shipping || 0)
}

function getRecommendation(item, quotes, product) {
  const itemQuotes = quotes
    .filter((quote) => quote.shopping_item_id === item.id)
    .sort((a, b) => quoteEffectivePrice(a) - quoteEffectivePrice(b))

  if (itemQuotes.length < 2) {
    return {
      status: 'missing',
      message: `Faltam ${2 - itemQuotes.length} cotacao(oes)`,
      quote: null,
      saving: 0,
    }
  }

  const best = itemQuotes[0]
  const lastPrice = Number(product?.last_price || 0)
  const saving = lastPrice > 0 ? (lastPrice - quoteEffectivePrice(best)) * item.quantity : 0

  return {
    status: 'ready',
    message: `${best.establishment} por ${money(quoteEffectivePrice(best))}`,
    quote: best,
    saving,
  }
}

function isNearCampaign(campaign) {
  const todayWeekday = new Date().getDay()
  const diff = (Number(campaign.weekday) - todayWeekday + 7) % 7
  return diff <= 2
}

export default function App() {
  const [session, setSession] = useState(null)
  const [isLocalSession, setIsLocalSession] = useState(false)
  const [activeTab, setActiveTab] = useState('lista')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [data, setData] = useState(EMPTY_STATE)
  const [editingItemId, setEditingItemId] = useState('')
  const [editingQuoteId, setEditingQuoteId] = useState('')
  const [productForm, setProductForm] = useState({
    selectedProductId: '',
    name: '',
    category: '',
    unit: 'un',
    quantity: 1,
    last_price: '',
    last_store: '',
    last_purchase_date: today(),
  })
  const [quoteForm, setQuoteForm] = useState({
    shopping_item_id: '',
    establishment: '',
    price: '',
    shipping: '',
    source: 'physical',
    quoted_at: today(),
    note: '',
  })
  const [marketForm, setMarketForm] = useState({
    name: '',
    region: '',
    weekday: 1,
    category: '',
    description: '',
  })

  const enrichedItems = useMemo(() => {
    return data.shoppingItems.map((item) => {
      const product = data.products.find((entry) => entry.id === item.product_id)
      const itemQuotes = data.quotes.filter((quote) => quote.shopping_item_id === item.id)
      return { ...item, product, quotes: itemQuotes, recommendation: getRecommendation(item, data.quotes, product) }
    })
  }, [data])

  const dashboard = useMemo(() => {
    const pendingItems = enrichedItems.filter((item) => item.status !== 'purchased')
    const readyItems = pendingItems.filter((item) => item.recommendation.status === 'ready')
    const missingQuotes = pendingItems.filter((item) => item.recommendation.status === 'missing')
    const totalSaving = readyItems.reduce((sum, item) => sum + Math.max(item.recommendation.saving, 0), 0)
    const onlineWins = readyItems.filter((item) => item.recommendation.quote?.source === 'online')

    return { pendingItems, readyItems, missingQuotes, totalSaving, onlineWins }
  }, [enrichedItems])

  const campaignSuggestions = useMemo(() => {
    return data.campaigns
      .filter((campaign) => campaign.active && isNearCampaign(campaign))
      .map((campaign) => ({
        ...campaign,
        supermarket: data.supermarkets.find((market) => market.id === campaign.supermarket_id),
      }))
  }, [data.campaigns, data.supermarkets])

  function persistLocal(nextData) {
    setData(nextData)
    if (isLocalSession) localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(nextData))
  }

  const startLocalMode = useCallback(() => {
    setIsLocalSession(true)
    setSession({ user: { id: LOCAL_USER_ID, email: email || 'teste@local' } })
  }, [email])

  async function loadRemoteData() {
    const responses = await Promise.all([
      supabase.from('supermercados').select('*').order('name'),
      supabase.from('produtos').select('*').order('name'),
      supabase.from('lista_compras').select('*').order('created_at', { ascending: false }),
      supabase.from('cotacoes').select('*').order('quoted_at', { ascending: false }),
      supabase.from('campanhas_semanais').select('*').order('weekday'),
      supabase.from('compras_realizadas').select('*').order('purchased_at', { ascending: false }),
    ])
    const failed = responses.find((response) => response.error)
    if (failed) throw failed.error

    return {
      supermarkets: responses[0].data || [],
      products: responses[1].data || [],
      shoppingItems: responses[2].data || [],
      quotes: responses[3].data || [],
      campaigns: responses[4].data || [],
      purchases: responses[5].data || [],
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: authData }) => {
      if (authData.session) setSession(authData.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setIsLocalSession(false)
        setSession(nextSession)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    async function load() {
      setLoading(true)
      setError('')

      if (isLocalSession || session.user.id === LOCAL_USER_ID) {
        await Promise.resolve()
        setData(safeJson(localStorage.getItem(LOCAL_STATE_KEY), null) || SAMPLE_STATE)
        setLoading(false)
        return
      }

      const remoteState = await loadRemoteData()
      setData(remoteState)
      setLoading(false)
    }

    load().catch(() => {
      setError('Nao foi possivel conectar ao Supabase. Usando modo teste local.')
      startLocalMode()
      setLoading(false)
    })
  }, [session, isLocalSession, startLocalMode])

  async function login() {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: TEST_PASSWORD })
      if (authError) setError(authError.message)
    } catch {
      setNotice('Supabase indisponivel. Voce entrou em modo teste local.')
      startLocalMode()
    } finally {
      setLoading(false)
    }
  }

  async function signup() {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      const { error: authError } = await supabase.auth.signUp({ email, password: TEST_PASSWORD })
      if (authError) setError(authError.message)
      else setNotice('Cadastro criado. Confira seu email se o Supabase pedir confirmacao.')
    } catch {
      setNotice('Supabase indisponivel. Voce entrou em modo teste local.')
      startLocalMode()
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    if (isLocalSession) {
      setSession(null)
      setData(EMPTY_STATE)
      setIsLocalSession(false)
      return
    }

    await supabase.auth.signOut()
    setSession(null)
    setData(EMPTY_STATE)
  }

  async function saveData(nextData, remoteAction) {
    setError('')
    persistLocal(nextData)

    if (!isLocalSession) {
      try {
        const { error: remoteError } = await remoteAction()
        if (remoteError) throw remoteError
      } catch (err) {
        setError(err.message || 'Nao foi possivel salvar no Supabase.')
      }
    }
  }

  async function addProductToList(event) {
    event.preventDefault()
    const name = normalizeText(productForm.name)
    if (!name) return

    if (editingItemId) {
      const currentItem = data.shoppingItems.find((item) => item.id === editingItemId)
      if (!currentItem) return

      const updatedProduct = {
        ...data.products.find((product) => product.id === currentItem.product_id),
        name,
        category: normalizeText(productForm.category) || 'Geral',
        unit: normalizeText(productForm.unit) || 'un',
        last_price: toNumber(productForm.last_price),
        last_store: normalizeText(productForm.last_store),
        last_purchase_date: productForm.last_purchase_date || null,
      }
      const updatedItem = {
        ...currentItem,
        quantity: Math.max(1, toNumber(productForm.quantity, 1)),
      }

      await saveData(
        {
          ...data,
          products: data.products.map((product) =>
            product.id === updatedProduct.id ? updatedProduct : product,
          ),
          shoppingItems: data.shoppingItems.map((item) =>
            item.id === editingItemId ? updatedItem : item,
          ),
        },
        async () => {
          const productUpdate = await supabase
            .from('produtos')
            .update({
              name: updatedProduct.name,
              category: updatedProduct.category,
              unit: updatedProduct.unit,
              last_price: updatedProduct.last_price,
              last_store: updatedProduct.last_store,
              last_purchase_date: updatedProduct.last_purchase_date,
            })
            .eq('id', updatedProduct.id)

          if (productUpdate.error) return productUpdate
          return supabase
            .from('lista_compras')
            .update({ quantity: updatedItem.quantity })
            .eq('id', updatedItem.id)
        },
      )

      resetProductForm()
      setEditingItemId('')
      return
    }

    const selectedProduct = data.products.find(
      (product) => product.id === productForm.selectedProductId,
    )

    if (selectedProduct) {
      const item = {
        id: makeId(),
        product_id: selectedProduct.id,
        quantity: Math.max(1, toNumber(productForm.quantity, 1)),
        status: 'pending',
        user_id: session.user.id,
        created_at: new Date().toISOString(),
      }

      await saveData(
        { ...data, shoppingItems: [item, ...data.shoppingItems] },
        () => supabase.from('lista_compras').insert(item),
      )

      resetProductForm()
      return
    }

    const product = {
      id: makeId(),
      name,
      category: normalizeText(productForm.category) || 'Geral',
      unit: normalizeText(productForm.unit) || 'un',
      last_price: toNumber(productForm.last_price),
      last_store: normalizeText(productForm.last_store),
      last_purchase_date: productForm.last_purchase_date || null,
      user_id: session.user.id,
      created_at: new Date().toISOString(),
    }
    const item = {
      id: makeId(),
      product_id: product.id,
      quantity: Math.max(1, toNumber(productForm.quantity, 1)),
      status: 'pending',
      user_id: session.user.id,
      created_at: new Date().toISOString(),
    }

    await saveData(
      { ...data, products: [product, ...data.products], shoppingItems: [item, ...data.shoppingItems] },
      async () => {
        const productInsert = await supabase.from('produtos').insert(product)
        if (productInsert.error) return productInsert
        return supabase.from('lista_compras').insert(item)
      },
    )

    resetProductForm()
  }

  function resetProductForm() {
    setProductForm({ selectedProductId: '', name: '', category: '', unit: 'un', quantity: 1, last_price: '', last_store: '', last_purchase_date: today() })
  }

  function editShoppingItem(item) {
    const product = data.products.find((entry) => entry.id === item.product_id)
    if (!product) return

    setEditingItemId(item.id)
    setProductForm({
      selectedProductId: '',
      name: product.name,
      category: product.category,
      unit: product.unit || 'un',
      quantity: item.quantity,
      last_price: product.last_price || '',
      last_store: product.last_store || '',
      last_purchase_date: product.last_purchase_date || today(),
    })
    setActiveTab('lista')
  }

  function selectKnownProduct(productId) {
    const product = data.products.find((entry) => entry.id === productId)
    if (!product) {
      resetProductForm()
      return
    }

    setProductForm({
      selectedProductId: product.id,
      name: product.name,
      category: product.category,
      unit: product.unit || 'un',
      quantity: 1,
      last_price: product.last_price || '',
      last_store: product.last_store || '',
      last_purchase_date: product.last_purchase_date || today(),
    })
  }

  async function deleteShoppingItem(item) {
    const nextData = {
      ...data,
      shoppingItems: data.shoppingItems.filter((entry) => entry.id !== item.id),
      quotes: data.quotes.filter((quote) => quote.shopping_item_id !== item.id),
      purchases: data.purchases.map((purchase) =>
        purchase.shopping_item_id === item.id ? { ...purchase, shopping_item_id: null } : purchase,
      ),
    }

    await saveData(nextData, async () => {
      return supabase.from('lista_compras').delete().eq('id', item.id)
    })

    if (editingItemId === item.id) {
      resetProductForm()
      setEditingItemId('')
    }
  }

  async function addQuote(event) {
    event.preventDefault()
    const selectedItem = data.shoppingItems.find((item) => item.id === quoteForm.shopping_item_id)
    if (!selectedItem) return

    const currentQuotes = data.quotes.filter((quote) => quote.shopping_item_id === quoteForm.shopping_item_id)
    if (!editingQuoteId && currentQuotes.length >= 3) {
      setError('Cada item pode ter no maximo 3 cotacoes ativas.')
      return
    }

    const quote = {
      id: makeId(),
      shopping_item_id: quoteForm.shopping_item_id,
      establishment: normalizeText(quoteForm.establishment),
      price: toNumber(quoteForm.price),
      shipping: quoteForm.source === 'online' ? toNumber(quoteForm.shipping) : 0,
      source: quoteForm.source,
      quoted_at: quoteForm.quoted_at || today(),
      note: normalizeText(quoteForm.note),
      user_id: session.user.id,
    }
    if (!quote.establishment || quote.price <= 0) return

    if (editingQuoteId) {
      const updatedQuote = { ...quote, id: editingQuoteId }

      await saveData(
        {
          ...data,
          quotes: data.quotes.map((entry) =>
            entry.id === editingQuoteId ? updatedQuote : entry,
          ),
        },
        () =>
          supabase
            .from('cotacoes')
            .update({
              shopping_item_id: updatedQuote.shopping_item_id,
              establishment: updatedQuote.establishment,
              price: updatedQuote.price,
              shipping: updatedQuote.shipping,
              source: updatedQuote.source,
              quoted_at: updatedQuote.quoted_at,
              note: updatedQuote.note,
            })
            .eq('id', updatedQuote.id),
      )

      setEditingQuoteId('')
      resetQuoteForm()
      return
    }

    await saveData({ ...data, quotes: [quote, ...data.quotes] }, () => supabase.from('cotacoes').insert(quote))
    setQuoteForm({
      ...quoteForm,
      shopping_item_id: '',
      price: '',
      shipping: '',
      note: '',
    })
  }

  function resetQuoteForm() {
    setQuoteForm({
      shopping_item_id: '',
      establishment: '',
      price: '',
      shipping: '',
      source: 'physical',
      quoted_at: today(),
      note: '',
    })
  }

  function editQuote(quote) {
    setEditingQuoteId(quote.id)
    setQuoteForm({
      shopping_item_id: quote.shopping_item_id,
      establishment: quote.establishment,
      price: quote.price,
      shipping: quote.shipping || '',
      source: quote.source,
      quoted_at: quote.quoted_at || today(),
      note: quote.note || '',
    })
    setActiveTab('cotacoes')
  }

  async function deleteQuote(quote) {
    await saveData(
      {
        ...data,
        quotes: data.quotes.filter((entry) => entry.id !== quote.id),
      },
      () => supabase.from('cotacoes').delete().eq('id', quote.id),
    )

    if (editingQuoteId === quote.id) {
      setEditingQuoteId('')
      resetQuoteForm()
    }
  }

  async function addMarketAndCampaign(event) {
    event.preventDefault()
    const marketName = normalizeText(marketForm.name)
    if (!marketName) return

    const market = {
      id: makeId(),
      name: marketName,
      region: normalizeText(marketForm.region),
      user_id: session.user.id,
      created_at: new Date().toISOString(),
    }
    const campaign = {
      id: makeId(),
      supermarket_id: market.id,
      weekday: Number(marketForm.weekday),
      category: normalizeText(marketForm.category) || 'Geral',
      description: normalizeText(marketForm.description),
      active: true,
      user_id: session.user.id,
    }

    await saveData(
      { ...data, supermarkets: [market, ...data.supermarkets], campaigns: [campaign, ...data.campaigns] },
      async () => {
        const marketInsert = await supabase.from('supermercados').insert(market)
        if (marketInsert.error) return marketInsert
        return supabase.from('campanhas_semanais').insert(campaign)
      },
    )
    setMarketForm({ name: '', region: '', weekday: 1, category: '', description: '' })
  }

  async function markPurchased(item) {
    const product = data.products.find((entry) => entry.id === item.product_id)
    const recommendation = getRecommendation(item, data.quotes, product)
    if (!recommendation.quote) {
      setError('Adicione pelo menos 2 cotacoes antes de registrar a compra.')
      return
    }

    const purchase = {
      id: makeId(),
      product_id: item.product_id,
      shopping_item_id: item.id,
      quantity: item.quantity,
      paid_price: quoteEffectivePrice(recommendation.quote),
      establishment: recommendation.quote.establishment,
      purchased_at: today(),
      user_id: session.user.id,
    }
    const updatedProduct = {
      ...product,
      last_price: purchase.paid_price,
      last_store: purchase.establishment,
      last_purchase_date: purchase.purchased_at,
    }
    const nextData = {
      ...data,
      products: data.products.map((entry) => (entry.id === product.id ? updatedProduct : entry)),
      shoppingItems: data.shoppingItems.map((entry) => (entry.id === item.id ? { ...entry, status: 'purchased' } : entry)),
      purchases: [purchase, ...data.purchases],
    }

    await saveData(nextData, async () => {
      const productUpdate = await supabase
        .from('produtos')
        .update({
          last_price: updatedProduct.last_price,
          last_store: updatedProduct.last_store,
          last_purchase_date: updatedProduct.last_purchase_date,
        })
        .eq('id', product.id)
      if (productUpdate.error) return productUpdate

      const itemUpdate = await supabase.from('lista_compras').update({ status: 'purchased' }).eq('id', item.id)
      if (itemUpdate.error) return itemUpdate
      return supabase.from('compras_realizadas').insert(purchase)
    })
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Compras domesticas</p>
          <h1>Economize escolhendo onde comprar cada item</h1>
          <p>Controle campanhas, ultimos precos e cotacoes para proteger o dinheiro da casa.</p>

          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="familia@email.com" type="email" />
          </label>

          {error && <p className="message error">{error}</p>}
          {notice && <p className="message success">{notice}</p>}

          <div className="actions">
            <button type="button" onClick={login} disabled={loading}>Entrar</button>
            <button type="button" className="secondary" onClick={signup} disabled={loading}>Cadastrar</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Controle inteligente</p>
          <h1>Compras da Casa</h1>
          <p>{session.user.email}</p>
        </div>
        <button type="button" className="secondary" onClick={logout}>Sair</button>
      </header>

      {(error || notice || isLocalSession) && (
        <section className="status-stack">
          {isLocalSession && <p className="message warning">Modo teste local ativo. Os dados ficam neste navegador.</p>}
          {notice && <p className="message success">{notice}</p>}
          {error && <p className="message error">{error}</p>}
        </section>
      )}

      <section className="summary-grid">
        <article className="summary-card"><span>Economia estimada</span><strong>{money(dashboard.totalSaving)}</strong></article>
        <article className="summary-card"><span>Itens para comprar</span><strong>{dashboard.pendingItems.length}</strong></article>
        <article className="summary-card"><span>Sem cotacao suficiente</span><strong>{dashboard.missingQuotes.length}</strong></article>
        <article className="summary-card"><span>Internet vantajosa</span><strong>{dashboard.onlineWins.length}</strong></article>
      </section>

      <nav className="tabbar" aria-label="Areas do sistema">
        {[
          ['lista', 'Lista'],
          ['cotacoes', 'Cotacoes'],
          ['mercados', 'Mercados'],
          ['historico', 'Historico'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </nav>

      {loading && <p className="message">Carregando dados...</p>}

      {activeTab === 'lista' && (
        <section className="workspace">
          <form className="panel form-grid" onSubmit={addProductToList}>
            <h2>{editingItemId ? 'Editar item' : 'Novo item'}</h2>
            {!editingItemId && data.products.length > 0 && (
              <label className="wide">
                Produto ja cadastrado
                <select
                  value={productForm.selectedProductId}
                  onChange={(event) => selectKnownProduct(event.target.value)}
                >
                  <option value="">Cadastrar novo produto</option>
                  {[...data.products]
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.unit || 'un'} | ultimo {money(product.last_price)}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>Produto<input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Ex.: Arroz 5 kg" /></label>
            <label>Categoria<input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} placeholder="Mercearia, limpeza..." /></label>
            <label>
              Unidade
              <input
                value={productForm.unit}
                onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                placeholder="Ex.: kg, pc, un, fardo"
              />
            </label>
            <label>Quantidade<input value={productForm.quantity} min="1" onChange={(event) => setProductForm({ ...productForm, quantity: event.target.value })} type="number" /></label>
            <label>Ultimo preco pago<input value={productForm.last_price} onChange={(event) => setProductForm({ ...productForm, last_price: event.target.value })} placeholder="0,00" /></label>
            <label>Ultimo estabelecimento<input value={productForm.last_store} onChange={(event) => setProductForm({ ...productForm, last_store: event.target.value })} placeholder="Mercado onde comprou" /></label>
            <label>Data da ultima compra<input value={productForm.last_purchase_date} onChange={(event) => setProductForm({ ...productForm, last_purchase_date: event.target.value })} type="date" /></label>
            <button type="submit">{editingItemId ? 'Salvar alteracoes' : 'Adicionar a lista'}</button>
            {editingItemId && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetProductForm()
                  setEditingItemId('')
                }}
              >
                Cancelar edicao
              </button>
            )}
          </form>

          <section className="panel">
            <h2>Lista de compras</h2>
            <div className="item-list">
              {enrichedItems.length === 0 && <p className="empty">Adicione o primeiro item para iniciar as cotacoes.</p>}
              {[...enrichedItems]
                .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
                .map((item) => (
                <article key={item.id} className="shopping-card">
                  <div>
                    <strong>{item.product?.name}</strong>
                    <p>{item.quantity} {item.product?.unit || 'un'} | Ultimo: {money(item.product?.last_price)} em {item.product?.last_store || 'sem registro'}</p>
                  </div>
                  <span className={`pill ${item.recommendation.status}`}>{item.recommendation.message}</span>
                  <div className="card-actions">
                    <button type="button" className="secondary" onClick={() => editShoppingItem(item)}>Editar</button>
                    <button type="button" className="danger" onClick={() => deleteShoppingItem(item)}>Excluir</button>
                    {item.recommendation.status === 'ready' && <button type="button" onClick={() => markPurchased(item)}>Registrar compra</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'cotacoes' && (
        <section className="workspace">
          <form className="panel form-grid" onSubmit={addQuote}>
            <h2>{editingQuoteId ? 'Editar cotacao' : 'Nova cotacao'}</h2>
            <label>
              Item da lista
              <select value={quoteForm.shopping_item_id} onChange={(event) => setQuoteForm({ ...quoteForm, shopping_item_id: event.target.value })}>
                <option value="">Selecione</option>
                {[...enrichedItems]
                  .filter((item) => item.status !== 'purchased')
                  .sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || ''))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.product?.name} - {item.product?.unit || 'un'} ({item.quotes.length}/3)
                    </option>
                  ))}
              </select>
            </label>
            <label>Estabelecimento<input value={quoteForm.establishment} onChange={(event) => setQuoteForm({ ...quoteForm, establishment: event.target.value })} placeholder="Mercado ou loja online" /></label>
            <label>
              Origem
              <select value={quoteForm.source} onChange={(event) => setQuoteForm({ ...quoteForm, source: event.target.value })}>
                <option value="physical">Supermercado fisico</option>
                <option value="online">Internet</option>
              </select>
            </label>
            <label>Preco<input value={quoteForm.price} onChange={(event) => setQuoteForm({ ...quoteForm, price: event.target.value })} placeholder="0,00" /></label>
            <label>Frete<input value={quoteForm.shipping} onChange={(event) => setQuoteForm({ ...quoteForm, shipping: event.target.value })} placeholder="0,00" disabled={quoteForm.source !== 'online'} /></label>
            <label>Data<input value={quoteForm.quoted_at} onChange={(event) => setQuoteForm({ ...quoteForm, quoted_at: event.target.value })} type="date" /></label>
            <label className="wide">Observacao<input value={quoteForm.note} onChange={(event) => setQuoteForm({ ...quoteForm, note: event.target.value })} placeholder="Campanha, app, atacado, cupom..." /></label>
            <button type="submit">{editingQuoteId ? 'Salvar alteracoes' : 'Salvar cotacao'}</button>
            {editingQuoteId && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditingQuoteId('')
                  resetQuoteForm()
                }}
              >
                Cancelar edicao
              </button>
            )}
          </form>

          <section className="panel">
            <h2>Comparativo</h2>
            <div className="quote-groups">
              {enrichedItems.map((item) => (
                <article key={item.id} className="quote-card">
                  <div className="quote-header"><strong>{item.product?.name}</strong><span>{item.quotes.length}/3 cotacoes</span></div>
                  {item.quotes.length === 0 && <p className="empty">Nenhuma cotacao registrada.</p>}
                  {[...item.quotes].sort((a, b) => quoteEffectivePrice(a) - quoteEffectivePrice(b)).map((quote, index) => (
                    <div key={quote.id} className={index === 0 ? 'quote best' : 'quote'}>
                      <div><strong>{quote.establishment}</strong><p>{quote.source === 'online' ? 'Internet' : 'Fisico'} | {quote.note || 'sem observacao'}</p></div>
                      <strong>{money(quoteEffectivePrice(quote))}</strong>
                      <div className="quote-actions">
                        <button type="button" className="secondary" onClick={() => editQuote(quote)}>Editar</button>
                        <button type="button" className="danger" onClick={() => deleteQuote(quote)}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'mercados' && (
        <section className="workspace">
          <form className="panel form-grid" onSubmit={addMarketAndCampaign}>
            <h2>Mercado e campanha</h2>
            <label>Supermercado<input value={marketForm.name} onChange={(event) => setMarketForm({ ...marketForm, name: event.target.value })} placeholder="Nome do mercado" /></label>
            <label>Regiao<input value={marketForm.region} onChange={(event) => setMarketForm({ ...marketForm, region: event.target.value })} placeholder="Bairro, cidade ou online" /></label>
            <label>
              Dia fixo
              <select value={marketForm.weekday} onChange={(event) => setMarketForm({ ...marketForm, weekday: event.target.value })}>
                {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <label>Categoria<input value={marketForm.category} onChange={(event) => setMarketForm({ ...marketForm, category: event.target.value })} placeholder="Hortifruti, limpeza..." /></label>
            <label className="wide">Descricao<input value={marketForm.description} onChange={(event) => setMarketForm({ ...marketForm, description: event.target.value })} placeholder="O que costuma valer a pena nesse dia" /></label>
            <button type="submit">Salvar campanha</button>
          </form>

          <section className="panel">
            <h2>Campanhas semanais</h2>
            {campaignSuggestions.length > 0 && (
              <div className="highlight">Cotar em breve: {campaignSuggestions.map((campaign) => `${campaign.category} no ${campaign.supermarket?.name}`).join(', ')}</div>
            )}
            <div className="campaign-list">
              {data.campaigns.map((campaign) => {
                const market = data.supermarkets.find((entry) => entry.id === campaign.supermarket_id)
                return (
                  <article key={campaign.id} className="campaign-card">
                    <span>{DAYS[campaign.weekday]}</span>
                    <div><strong>{campaign.category} | {market?.name}</strong><p>{campaign.description || market?.region || 'Sem detalhe informado'}</p></div>
                  </article>
                )
              })}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'historico' && (
        <section className="panel">
          <h2>Historico de compras</h2>
          {data.purchases.length === 0 && <p className="empty">Quando uma compra for registrada, ela aparecera aqui e atualizara o ultimo preco do produto.</p>}
          <div className="history-list">
            {data.purchases.map((purchase) => {
              const product = data.products.find((entry) => entry.id === purchase.product_id)
              return (
                <article key={purchase.id} className="history-card">
                  <strong>{product?.name}</strong>
                  <span>{money(purchase.paid_price)}</span>
                  <p>{purchase.quantity} {product?.unit || 'un'} em {purchase.establishment} | {purchase.purchased_at}</p>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
