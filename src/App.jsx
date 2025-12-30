import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, X, Check, TrendingUp, Package, Users, ChefHat, ShoppingCart, DollarSign, Clock, Trash2, Sparkles, LogOut, Mail, Lock } from 'lucide-react'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export default function CooksyApp() {
  const [view, setView] = useState('dashboard')
  const [recipes, setRecipes] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [orders, setOrders] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [orderForm, setOrderForm] = useState({ recipe_id: '', customer: '', qty: 1 })
  const [recipeForm, setRecipeForm] = useState({ name: '', price: '', yield: 1 })
  const [ingForm, setIngForm] = useState({ name: '', qty: '', unit: '', cpu: '' })
  const [authForm, setAuthForm] = useState({ email: '', password: '' })

  useEffect(() => {
    checkUser()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
      if (session?.user) load()
    })
    return () => authListener?.subscription?.unsubscribe()
  }, [])

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      if (session?.user) await load()
    } catch (err) {
      console.error('Auth check error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function load() {
    try {
      setError('')
      const [r, i, o] = await Promise.all([
        supabase.from('recipes').select('*').order('name'),
        supabase.from('ingredients').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false })
      ])
      
      if (r.error) throw r.error
      if (i.error) throw i.error
      if (o.error) throw o.error
      
      setRecipes(r.data || [])
      setIngredients(i.data || [])
      setOrders(o.data || [])
      
      if ((r.data || []).length === 0 && !localStorage.getItem('cooksy_onboarded')) {
        setShowOnboarding(true)
      }
    } catch (err) {
      console.error('Load error:', err)
      setError('Failed to load data. Please refresh.')
    }
  }

  async function signUp() {
    try {
      setError('')
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      })
      if (error) throw error
      setError('')
      // Show custom success modal
      const modal = document.createElement('div')
      modal.className = 'success-modal-overlay'
      modal.innerHTML = `
        <div class="success-modal">
          <div class="success-icon">✓</div>
          <h2 style="font-size: 28px; font-weight: 800; margin-bottom: 12px;">Account Created!</h2>
          <p style="font-size: 16px; color: rgba(255,255,255,0.8); line-height: 1.6; margin-bottom: 24px;">
            Check your email to confirm your account, then come back here to sign in and start tracking your recipes.
          </p>
          <button class="btn btn-primary" style="width: 100%; padding: 16px;" onclick="this.closest('.success-modal-overlay').remove()">
            Got it!
          </button>
        </div>
      `
      document.body.appendChild(modal)
      setAuthMode('login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function signIn() {
    try {
      setError('')
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setRecipes([])
    setIngredients([])
    setOrders([])
  }

  const getUnitCost = r => {
    const ings = ingredients.filter(ing => ing.recipe_id === r.id)
    const total = ings.reduce((s, i) => s + (i.quantity * i.cost_per_unit), 0)
    return total / (r.yield_qty || 1)
  }

  const getMargin = r => {
    const cost = getUnitCost(r)
    return ((r.price - cost) / r.price * 100).toFixed(1)
  }

  const getShoppingList = () => {
    const list = {}
    orders.filter(o => !o.fulfilled).forEach(o => {
      const r = recipes.find(rec => rec.id === o.recipe_id)
      const multiplier = o.quantity / (r?.yield_qty || 1)
      ingredients.filter(ing => ing.recipe_id === o.recipe_id).forEach(ing => {
        const key = ing.name
        if (!list[key]) list[key] = { name: ing.name, qty: 0, unit: ing.unit }
        list[key].qty += (ing.quantity * multiplier)
      })
    })
    return Object.values(list)
  }

  const stats = {
    totalProfit: orders.reduce((s, o) => s + ((o.price_at_order - o.cost_at_order) * o.quantity), 0),
    openOrders: orders.filter(o => !o.fulfilled).length,
    completedOrders: orders.filter(o => o.fulfilled).length,
    totalCustomers: new Set(orders.map(o => o.customer_name)).size
  }

  const openModal = (type, recipe = null) => {
    setModalType(type)
    setSelectedRecipe(recipe)
    setShowModal(true)
    if (type === 'recipe') setRecipeForm({ name: '', price: '', yield: 1 })
  }

  const addRecipe = async () => {
    try {
      setError('')
      const { error } = await supabase.from('recipes').insert({
        name: recipeForm.name,
        price: Number(recipeForm.price),
        yield_qty: Number(recipeForm.yield),
        user_id: user.id
      })
      if (error) throw error
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteRecipe = async (id) => {
    if (confirm('Delete this recipe?')) {
      try {
        await supabase.from('ingredients').delete().eq('recipe_id', id)
        await supabase.from('recipes').delete().eq('id', id)
        await load()
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const addIngredient = async () => {
    try {
      setError('')
      const { error } = await supabase.from('ingredients').insert({
        recipe_id: selectedRecipe.id,
        name: ingForm.name,
        quantity: Number(ingForm.qty),
        unit: ingForm.unit,
        cost_per_unit: Number(ingForm.cpu),
        user_id: user.id
      })
      if (error) throw error
      setIngForm({ name: '', qty: '', unit: '', cpu: '' })
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const createOrder = async () => {
    try {
      setError('')
      const r = recipes.find(x => x.id === orderForm.recipe_id)
      const { error } = await supabase.from('orders').insert({
        recipe_id: r.id,
        recipe_name: r.name,
        customer_name: orderForm.customer,
        quantity: Number(orderForm.qty),
        price_at_order: r.price,
        cost_at_order: getUnitCost(r),
        user_id: user.id
      })
      if (error) throw error
      setShowModal(false)
      setOrderForm({ recipe_id: '', customer: '', qty: 1 })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const fulfillOrder = async (id) => {
    try {
      const { error } = await supabase.from('orders').update({ fulfilled: true }).eq('id', id)
      if (error) throw error
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const startOnboarding = () => {
    localStorage.setItem('cooksy_onboarded', 'true')
    setShowOnboarding(false)
    openModal('recipe')
  }

  if (loading && !user) {
    return (
      <>
        <style>{styles}</style>
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div style={{color: '#fff', fontSize: '24px', fontWeight: 700, marginTop: '20px'}}>Loading...</div>
        </div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-logo">
              <ChefHat size={48} strokeWidth={2.5} />
              <div style={{fontSize: '42px', fontWeight: 800, marginTop: '16px'}}>COOKSY</div>
            </div>
            <p style={{fontSize: '16px', color: 'rgba(255,255,255,0.8)', marginBottom: '32px', textAlign: 'center', lineHeight: '1.6'}}>
              Track recipe costs, manage orders, and grow your baking business with real-time profit tracking.
            </p>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="input-group">
              <label className="input-label">Email</label>
              <div style={{position: 'relative'}}>
                <Mail size={18} style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)'}} />
                <input 
                  type="email" 
                  className="input" 
                  style={{paddingLeft: '44px'}}
                  placeholder="you@example.com" 
                  value={authForm.email} 
                  onChange={e => setAuthForm({...authForm, email: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{position: 'relative'}}>
                <Lock size={18} style={{position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)'}} />
                <input 
                  type="password" 
                  className="input" 
                  style={{paddingLeft: '44px'}}
                  placeholder="••••••••" 
                  value={authForm.password} 
                  onChange={e => setAuthForm({...authForm, password: e.target.value})} 
                />
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{width: '100%', marginBottom: '12px', padding: '16px 28px'}} 
              onClick={authMode === 'login' ? signIn : signUp}
              disabled={loading || !authForm.email || !authForm.password}
            >
              {loading ? 'Please wait...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
            
            <button 
              className="btn btn-secondary" 
              style={{width: '100%', padding: '16px 28px'}} 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>

      <div className="app">
        <div className="sidebar">
          <div className="logo-section">
            <div className="logo">
              <ChefHat size={32} strokeWidth={2.5} />
              COOKSY
            </div>
          </div>
          <div className="nav-section">
            <div className={`nav ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
              <TrendingUp size={20} strokeWidth={2.5} />
              <span>Dashboard</span>
            </div>
            <div className={`nav ${view === 'orders' ? 'active' : ''}`} onClick={() => setView('orders')}>
              <ShoppingCart size={20} strokeWidth={2.5} />
              <span>Orders</span>
            </div>
            <div className={`nav ${view === 'recipes' ? 'active' : ''}`} onClick={() => setView('recipes')}>
              <Package size={20} strokeWidth={2.5} />
              <span>Recipes</span>
            </div>
            <div className={`nav ${view === 'customers' ? 'active' : ''}`} onClick={() => setView('customers')}>
              <Users size={20} strokeWidth={2.5} />
              <span>Customers</span>
            </div>
            <div className="nav" onClick={signOut} style={{marginTop: 'auto'}}>
              <LogOut size={20} strokeWidth={2.5} />
              <span>Sign Out</span>
            </div>
          </div>
        </div>

        <div className="main">
          {error && <div className="error-banner">{error}</div>}
          
          {view === 'dashboard' && (
            <div>
              <div className="page-header">
                <div className="page-title">The Kitchen</div>
                <div className="page-subtitle">Track profits, manage orders, and grow your baking business</div>
              </div>

              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon"><DollarSign size={28} strokeWidth={2.5} /></div>
                  <div className="metric-value">${stats.totalProfit.toFixed(0)}</div>
                  <div className="metric-label">Total Profit</div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon"><Clock size={28} strokeWidth={2.5} /></div>
                  <div className="metric-value">{stats.openOrders}</div>
                  <div className="metric-label">To Bake</div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon"><Check size={28} strokeWidth={2.5} /></div>
                  <div className="metric-value">{stats.completedOrders}</div>
                  <div className="metric-label">Completed</div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon"><Users size={28} strokeWidth={2.5} /></div>
                  <div className="metric-value">{stats.totalCustomers}</div>
                  <div className="metric-label">Customers</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Active Orders</div>
                    <button className="btn btn-primary btn-icon" onClick={() => openModal('order')}>
                      <Plus size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                  {orders.filter(o => !o.fulfilled).length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><ShoppingCart size={56} strokeWidth={1.5} /></div>
                      <div className="empty-title">No active orders</div>
                      <div className="empty-text">Click + to create your first order</div>
                    </div>
                  ) : (
                    <div className="item-list">
                      {orders.filter(o => !o.fulfilled).map(o => (
                        <div key={o.id} className="item-row">
                          <div className="item-content">
                            <div className="item-title">{o.quantity}× {o.recipe_name}</div>
                            <div className="item-subtitle">{o.customer_name}</div>
                          </div>
                          <button className="btn btn-success btn-icon" onClick={() => fulfillOrder(o.id)}>
                            <Check size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Shopping List</div>
                  </div>
                  {getShoppingList().length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><Package size={56} strokeWidth={1.5} /></div>
                      <div className="empty-title">Nothing to buy</div>
                      <div className="empty-text">Your shopping list will appear here</div>
                    </div>
                  ) : (
                    <div className="item-list">
                      {getShoppingList().map(item => (
                        <div key={item.name} className="item-row">
                          <div className="item-content">
                            <div className="item-title">{item.name}</div>
                          </div>
                          <span className="badge badge-info">{item.qty.toFixed(1)} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'orders' && (
            <div>
              <div className="page-header">
                <div className="page-title">Orders</div>
                <div className="page-subtitle">Log sales and track fulfillment</div>
              </div>
              <button className="btn btn-primary" style={{marginBottom: 24}} onClick={() => openModal('order')}>
                <Plus size={18} strokeWidth={2.5} />New Order
              </button>
              <div className="card">
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><ShoppingCart size={56} strokeWidth={1.5} /></div>
                    <div className="empty-title">No orders yet</div>
                    <div className="empty-text">Start logging your sales</div>
                  </div>
                ) : (
                  <div className="item-list">
                    {orders.map(o => (
                      <div key={o.id} className="item-row">
                        <div className="item-content">
                          <div className="item-title">{o.quantity}× {o.recipe_name}</div>
                          <div className="item-subtitle">{o.customer_name} · ${(o.price_at_order * o.quantity).toFixed(2)}</div>
                        </div>
                        {o.fulfilled ? (
                          <span className="badge badge-success"><Check size={14} strokeWidth={2.5} /> Done</span>
                        ) : (
                          <button className="btn btn-success btn-icon" onClick={() => fulfillOrder(o.id)}>
                            <Check size={18} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'recipes' && (
            <div>
              <div className="page-header">
                <div className="page-title">Recipe Vault</div>
                <div className="page-subtitle">Build recipes and calculate costs</div>
              </div>
              <button className="btn btn-primary" style={{marginBottom: 24}} onClick={() => openModal('recipe')}>
                <Plus size={18} strokeWidth={2.5} />New Recipe
              </button>
              {recipes.length === 0 ? (
                <div className="card">
                  <div className="empty-state">
                    <div className="empty-icon"><Package size={56} strokeWidth={1.5} /></div>
                    <div className="empty-title">No recipes yet</div>
                    <div className="empty-text">Create your first recipe to get started</div>
                  </div>
                </div>
              ) : (
                recipes.map(r => (
                  <div key={r.id} className="recipe-card">
                    <div className="recipe-header">
                      <div className="recipe-info">
                        <h3>{r.name}</h3>
                        <div className="recipe-meta">
                          <span>Makes {r.yield_qty} units</span>
                          <span>·</span>
                          <span>{ingredients.filter(i => i.recipe_id === r.id).length} ingredients</span>
                        </div>
                      </div>
                      <div>
                        <div className="recipe-price">${r.price.toFixed(2)}</div>
                        <div className="recipe-cost">Cost: ${getUnitCost(r).toFixed(2)}</div>
                        <div className="recipe-margin">{getMargin(r)}% margin</div>
                      </div>
                    </div>

                    {ingredients.filter(ing => ing.recipe_id === r.id).length > 0 && (
                      <table className="ingredients-table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Qty</th>
                            <th>$/Unit</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingredients.filter(ing => ing.recipe_id === r.id).map(ing => (
                            <tr key={ing.id}>
                              <td>{ing.name}</td>
                              <td>{ing.quantity} {ing.unit}</td>
                              <td>${ing.cost_per_unit.toFixed(2)}</td>
                              <td><strong>${(ing.quantity * ing.cost_per_unit).toFixed(2)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div style={{display: 'flex', gap: 12}}>
                      <button className="btn btn-secondary" onClick={() => openModal('ingredient', r)}>
                        <Plus size={16} strokeWidth={2.5} />Add Ingredient
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={() => deleteRecipe(r.id)}>
                        <Trash2 size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'customers' && (
            <div>
              <div className="page-header">
                <div className="page-title">Customers</div>
                <div className="page-subtitle">Your loyal fans</div>
              </div>
              <div className="card">
                {orders.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon"><Users size={56} strokeWidth={1.5} /></div>
                    <div className="empty-title">No customers yet</div>
                    <div className="empty-text">Create orders to see your customers</div>
                  </div>
                ) : (
                  <div className="item-list">
                    {Array.from(new Set(orders.map(o => o.customer_name))).map(name => {
                      const total = orders.filter(o => o.customer_name === name).reduce((s, o) => s + (o.price_at_order * o.quantity), 0)
                      const count = orders.filter(o => o.customer_name === name).length
                      return (
                        <div key={name} className="item-row">
                          <div className="item-content">
                            <div className="item-title">{name}</div>
                            <div className="item-subtitle">{count} orders</div>
                          </div>
                          <span className="badge badge-info">${total.toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <div className="onboarding-icon">
              <Sparkles size={64} strokeWidth={2} />
            </div>
            <h1 className="onboarding-title">Welcome to Cooksy!</h1>
            <p className="onboarding-text">
              Your all-in-one platform for tracking recipe costs, managing orders, and growing your baking business.
            </p>
            
            <div className="onboarding-steps">
              <div className="onboarding-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Create a Recipe</h4>
                  <p>Add your recipe with a price and yield amount</p>
                </div>
              </div>
              <div className="onboarding-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Add Ingredients</h4>
                  <p>List ingredients with quantities and costs to calculate margins</p>
                </div>
              </div>
              <div className="onboarding-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Log Sales</h4>
                  <p>Create orders to track profits and generate shopping lists</p>
                </div>
              </div>
            </div>
            
            <button className="btn btn-primary" style={{fontSize: 16, padding: '16px 40px'}} onClick={startOnboarding}>
              <Sparkles size={20} strokeWidth={2.5} />
              Get Started
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {modalType === 'order' && 'Create Order'}
                {modalType === 'recipe' && 'New Recipe'}
                {modalType === 'ingredient' && 'Add Ingredient'}
              </div>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {modalType === 'order' && (
              <div>
                <div className="input-group">
                  <label className="input-label">Customer Name</label>
                  <input className="input" placeholder="Who's buying?" value={orderForm.customer} onChange={e => setOrderForm({...orderForm, customer: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Recipe</label>
                  <select className="input" value={orderForm.recipe_id} onChange={e => setOrderForm({...orderForm, recipe_id: e.target.value})}>
                    <option value="">Pick a recipe</option>
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} - ${r.price}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Quantity</label>
                  <input type="number" className="input" value={orderForm.qty} onChange={e => setOrderForm({...orderForm, qty: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width: '100%'}} onClick={createOrder} disabled={!orderForm.recipe_id || !orderForm.customer}>
                  Create Order
                </button>
              </div>
            )}

            {modalType === 'recipe' && (
              <div>
                <div className="input-group">
                  <label className="input-label">Recipe Name</label>
                  <input className="input" placeholder="e.g. Chocolate Chip Cookies" value={recipeForm.name} onChange={e => setRecipeForm({...recipeForm, name: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Price per Unit ($)</label>
                  <input type="number" className="input" placeholder="12.00" value={recipeForm.price} onChange={e => setRecipeForm({...recipeForm, price: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Yield (units per batch)</label>
                  <input type="number" className="input" placeholder="12" value={recipeForm.yield} onChange={e => setRecipeForm({...recipeForm, yield: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width: '100%'}} onClick={addRecipe} disabled={!recipeForm.name || !recipeForm.price}>
                  Create Recipe
                </button>
              </div>
            )}

            {modalType === 'ingredient' && (
              <div>
                <div className="input-group">
                  <label className="input-label">Ingredient Name</label>
                  <input className="input" placeholder="e.g. All-purpose flour" value={ingForm.name} onChange={e => setIngForm({...ingForm, name: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Quantity</label>
                  <input type="number" className="input" placeholder="2.5" value={ingForm.qty} onChange={e => setIngForm({...ingForm, qty: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <input className="input" placeholder="cups" value={ingForm.unit} onChange={e => setIngForm({...ingForm, unit: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Cost per Unit ($)</label>
                  <input type="number" className="input" placeholder="0.50" value={ingForm.cpu} onChange={e => setIngForm({...ingForm, cpu: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width: '100%'}} onClick={addIngredient} disabled={!ingForm.name || !ingForm.qty}>
                  Add Ingredient
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  /* Hide scrollbars */
  * { scrollbar-width: none; -ms-overflow-style: none; }
  *::-webkit-scrollbar { display: none; }
  
  html, body, #root { height: 100%; overflow: auto; }
  body { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff; 
    font-family: 'Space Grotesk', -apple-system, sans-serif;
    -webkit-overflow-scrolling: touch;
  }
  
  .loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 9999;
  }
  
  .loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .success-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  }
  
  .success-modal {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
    backdrop-filter: blur(40px);
    border-radius: 28px;
    padding: 48px 40px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    animation: slideUp 0.4s ease;
  }
  
  .success-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(100, 255, 150, 0.2);
    color: #6bffb0;
    font-size: 48px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    animation: scaleIn 0.5s ease 0.2s both;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0); }
    to { transform: scale(1); }
  }
  
  .app { display: flex; min-height: 100vh; }
  .auth-container { 
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex; 
    align-items: center; 
    justify-content: center; 
    padding: 24px; 
    overflow: auto; 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  .auth-card { background: rgba(255,255,255,0.15); backdrop-filter: blur(40px); border-radius: 32px; padding: 48px 40px; max-width: 440px; width: 100%; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
  .auth-logo { text-align: center; margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; }
  .error-message { background: rgba(255, 100, 100, 0.2); border: 1px solid rgba(255, 100, 100, 0.3); color: #ffb3b3; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; font-size: 14px; font-weight: 600; }
  .error-banner { background: rgba(255, 100, 100, 0.2); border: 1px solid rgba(255, 100, 100, 0.3); color: #ffb3b3; padding: 16px 24px; border-radius: 16px; margin-bottom: 24px; font-size: 14px; font-weight: 600; }
  .sidebar { width: 260px; background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border-right: 1px solid rgba(255,255,255,0.12); position: fixed; height: 100vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.2); overflow-y: auto; }
  .logo-section { padding: 40px 24px 30px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .logo { font-weight: 800; font-size: 28px; display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #fff 0%, #e0e0ff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
  .nav-section { flex: 1; padding: 24px 16px; display: flex; flex-direction: column; }
  .nav { padding: 16px 18px; cursor: pointer; color: rgba(255,255,255,0.6); font-weight: 600; font-size: 15px; border-radius: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 14px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
  .nav:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); transform: translateX(4px); }
  .nav.active { color: #fff; background: rgba(255,255,255,0.15); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
  .nav.active::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 4px; height: 24px; background: #fff; border-radius: 0 4px 4px 0; }
  .main { flex: 1; margin-left: 260px; padding: 48px; background: transparent; overflow-y: auto; }
  .page-header { margin-bottom: 40px; }
  .page-title { font-size: 48px; font-weight: 800; margin-bottom: 12px; letter-spacing: -1px; text-shadow: 0 2px 20px rgba(0,0,0,0.2); }
  .page-subtitle { font-size: 17px; color: rgba(255,255,255,0.7); font-weight: 500; }
  .card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border-radius: 24px; padding: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.12); transition: all 0.3s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .card-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
  .metric-card { background: rgba(255,255,255,0.1); backdrop-filter: blur(20px); padding: 28px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.12); transition: all 0.3s ease; }
  .metric-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.25); }
  .metric-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; background: rgba(255,255,255,0.15); }
  .metric-value { font-size: 36px; font-weight: 800; margin-bottom: 6px; letter-spacing: -1px; }
  .metric-label { font-size: 14px; color: rgba(255,255,255,0.7); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .input-group { margin-bottom: 20px; }
  .input-label { display: block; font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.9); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .input, select.input { width: 100%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 14px 18px; border-radius: 12px; color: #fff; font-size: 15px; font-family: 'Space Grotesk', sans-serif; transition: all 0.3s ease; }
  select.input option { background: #764ba2; color: #fff; }
  .input::placeholder { color: rgba(255,255,255,0.4); }
  .input:focus { outline: none; border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.15); box-shadow: 0 0 0 4px rgba(255,255,255,0.1); }
  .btn { padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 10px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Space Grotesk', sans-serif; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4); }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(102, 126, 234, 0.5); }
  .btn-secondary { background: rgba(255,255,255,0.15); color: #fff; }
  .btn-secondary:hover { background: rgba(255,255,255,0.25); }
  .btn-danger { background: rgba(255, 100, 100, 0.2); color: #ff6b6b; }
  .btn-danger:hover { background: rgba(255, 100, 100, 0.3); }
  .btn-success { background: rgba(100, 255, 150, 0.2); color: #6bffb0; }
  .btn-success:hover { background: rgba(100, 255, 150, 0.3); }
  .btn-icon { padding: 12px; border-radius: 10px; }
  .item-list { display: flex; flex-direction: column; gap: 12px; }
  .item-row { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.3s ease; }
  .item-row:hover { background: rgba(255,255,255,0.1); transform: translateX(4px); }
  .item-content { flex: 1; }
  .item-title { font-weight: 700; margin-bottom: 6px; font-size: 16px; }
  .item-subtitle { font-size: 13px; color: rgba(255,255,255,0.6); }
  .badge { padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-success { background: rgba(100, 255, 150, 0.2); color: #6bffb0; }
  .badge-info { background: rgba(150, 200, 255, 0.2); color: #96c8ff; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .recipe-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border-radius: 24px; padding: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.12); margin-bottom: 20px; transition: all 0.3s ease; }
  .recipe-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
  .recipe-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 2px solid rgba(255,255,255,0.1); }
  .recipe-info h3 { font-size: 26px; font-weight: 800; margin-bottom: 10px; letter-spacing: -0.5px; }
  .recipe-meta { display: flex; gap: 16px; font-size: 14px; color: rgba(255,255,255,0.6); font-weight: 500; }
  .recipe-price { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
  .recipe-cost { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; }
  .recipe-margin { font-size: 13px; font-weight: 700; color: #6bffb0; margin-top: 6px; }
  .ingredients-table { width: 100%; margin-bottom: 24px; }
  .ingredients-table th { text-align: left; font-size: 11px; text-transform: uppercase; color: rgba(255,255,255,0.5); font-weight: 700; padding-bottom: 16px; border-bottom: 2px solid rgba(255,255,255,0.1); letter-spacing: 0.5px; }
  .ingredients-table td { padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; overflow-y: auto; }
  .modal { background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%); backdrop-filter: blur(40px); border-radius: 28px; padding: 40px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); margin: auto; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .modal-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .empty-state { text-align: center; padding: 80px 20px; color: rgba(255,255,255,0.5); }
  .empty-icon { margin-bottom: 20px; opacity: 0.3; }
  .empty-title { font-size: 20px; font-weight: 700; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
  .empty-text { font-size: 14px; color: rgba(255,255,255,0.5); }
  .onboarding-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 40px; overflow-y: auto; }
  .onboarding-card { background: rgba(255,255,255,0.15); backdrop-filter: blur(40px); border-radius: 32px; padding: 60px; max-width: 600px; text-align: center; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.3); margin: auto; }
  .onboarding-icon { margin-bottom: 32px; }
  .onboarding-title { font-size: 48px; font-weight: 800; margin-bottom: 20px; letter-spacing: -1px; }
  .onboarding-text { font-size: 18px; color: rgba(255,255,255,0.8); margin-bottom: 40px; line-height: 1.6; }
  .onboarding-steps { text-align: left; margin-bottom: 40px; background: rgba(255,255,255,0.1); padding: 32px; border-radius: 20px; }
  .onboarding-step { display: flex; align-items: start; gap: 16px; margin-bottom: 20px; }
  .step-number { background: rgba(255,255,255,0.2); width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0; }
  .step-content h4 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
  .step-content p { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5; }
  @media (max-width: 768px) {
    .sidebar { width: 100%; height: auto; bottom: 0; top: auto; flex-direction: row; border-right: none; border-top: 1px solid rgba(255,255,255,0.12); z-index: 100; position: fixed; }
    .logo-section { display: none; }
    .nav-section { display: flex; flex-direction: row; width: 100%; padding: 8px; overflow-x: auto; }
    .nav { flex-direction: column; padding: 12px 8px; font-size: 11px; gap: 6px; flex: 1; min-width: 70px; justify-content: center; text-align: center; white-space: nowrap; }
    .nav::before { display: none; }
    .main { margin-left: 0; padding: 24px; padding-bottom: 100px; }
    .page-title { font-size: 32px; }
    .metrics-grid, .grid-2 { grid-template-columns: 1fr; }
    .item-row { flex-direction: column; align-items: flex-start; gap: 12px; }
    .recipe-header { flex-direction: column; gap: 20px; }
    .onboarding-card { padding: 40px 24px; margin: 20px; }
    .onboarding-title { font-size: 32px; }
    .auth-card { padding: 40px 28px; }
    .modal { padding: 32px 24px; }
  }
`