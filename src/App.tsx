import { useState, useEffect } from "react";
import { getSupabaseClient, isSupabaseConfigured, getSupabaseUrl, getSupabasePublishableKey, resetSupabaseClient } from "./lib/supabase";
import { 
  Pizza, 
  Users, 
  ClipboardList, 
  TrendingUp, 
  Sparkles, 
  Phone, 
  User, 
  ShoppingBag, 
  CreditCard, 
  Receipt, 
  Plus, 
  Check, 
  Loader2, 
  AlertCircle, 
  TrendingDown,
  Calendar,
  Clock,
  ArrowRight,
  Settings
} from "lucide-react";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: "Base" | "Pizza" | "Topping";
}

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_name: string;
  category: "Base" | "Pizza" | "Topping";
  unit_price: number;
  quantity: number;
}

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  payment_mode: "Cash" | "Card" | "UPI";
  created_at: string;
  items?: OrderItem[];
}

export interface BasketItem {
  id: string;
  base_id: number;
  pizza_id: number;
  topping_ids: number[];
  quantity: number;
  baseName: string;
  basePrice: number;
  pizzaName: string;
  pizzaPrice: number;
  toppings: { id: number; name: string; price: number }[];
  unitTotal: number;
}

const DEFAULT_MENU: MenuItem[] = [
  // Base Crusts
  { id: 1, name: "Thin Crust", price: 150, category: "Base" },
  { id: 2, name: "Thick Crust", price: 180, category: "Base" },
  { id: 3, name: "Cheese Burst", price: 250, category: "Base" },
  { id: 4, name: "Gluten Free Crust", price: 220, category: "Base" },
  // Pizza Styles
  { id: 5, name: "Margherita", price: 299, category: "Pizza" },
  { id: 6, name: "Farmhouse", price: 399, category: "Pizza" },
  { id: 7, name: "Peppy Paneer", price: 420, category: "Pizza" },
  { id: 8, name: "Chicken Tikka", price: 480, category: "Pizza" },
  { id: 9, name: "Pepperoni Feast", price: 520, category: "Pizza" },
  { id: 10, name: "Veggie Paradise", price: 380, category: "Pizza" },
  // Toppings
  { id: 11, name: "Extra Cheese", price: 80, category: "Topping" },
  { id: 12, name: "Mushrooms", price: 60, category: "Topping" },
  { id: 13, name: "Black Olives", price: 50, category: "Topping" },
  { id: 14, name: "Jalapenos", price: 55, category: "Topping" },
  { id: 15, name: "Onions", price: 30, category: "Topping" },
  { id: 16, name: "Bell Peppers", price: 40, category: "Topping" },
  { id: 17, name: "Grilled Chicken", price: 120, category: "Topping" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"order" | "admin">("order");
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [orders, setOrders] = useState<Order[]>([]);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  
  // Admin Login States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Dynamic Supabase configurations
  const [isSupabaseActive, setIsSupabaseActive] = useState(isSupabaseConfigured());
  const [showSupaConfig, setShowSupaConfig] = useState(false);
  const [supaUrl, setSupaUrl] = useState(getSupabaseUrl() || "");
  const [supaPublishableKey, setSupaPublishableKey] = useState(getSupabasePublishableKey() || "");
  const [supaConfigSuccess, setSupaConfigSuccess] = useState("");

  // Supabase Signup States
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [signUpError, setSignUpError] = useState("");
  const [signUpSuccess, setSignUpSuccess] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);

  // Ordering form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedBase, setSelectedBase] = useState<number | null>(null);
  const [selectedPizza, setSelectedPizza] = useState<number | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Card" | "UPI" | null>(null);

  // Repeat customer check state
  const [repeatCustomer, setRepeatCustomer] = useState<any>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);

  // Success receipt state
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // AI Insights state
  const [insightsQuestion, setInsightsQuestion] = useState("");
  const [insightsAnswer, setInsightsAnswer] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  // General loading & error states
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Load menu items on startup
  useEffect(() => {
    fetchMenu();
  }, []);

  // Fetch orders when switching to admin view
  useEffect(() => {
    if (activeTab === "admin") {
      fetchOrders();
    }
  }, [activeTab]);

  // Handle phone number input to automatically look up returning customers
  useEffect(() => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
      lookupCustomer(cleanPhone);
    } else {
      setRepeatCustomer(null);
    }
  }, [customerPhone]);

  const fetchMenu = async () => {
    setLoadingMenu(true);
    setApiError(null);
    try {
      // Menu is statically pre-loaded, ensuring 100% availability
      setMenu(DEFAULT_MENU);
    } catch (err) {
      setApiError("Failed to load menu items.");
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: dbOrders, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        if (ordersErr) throw ordersErr;

        if (dbOrders) {
          const { data: dbItems, error: itemsErr } = await supabase
            .from("order_items")
            .select("*");

          if (itemsErr) throw itemsErr;

          if (dbItems) {
            const ordersWithItems = dbOrders.map((order: any) => {
              const items = dbItems.filter((item: any) => item.order_id === order.id);
              return { ...order, items };
            });
            setOrders(ordersWithItems);
            return;
          }
        }
      }
      
      // Fallback to local storage
      const localOrders = JSON.parse(localStorage.getItem("slicematic_local_orders") || "[]");
      const localItems = JSON.parse(localStorage.getItem("slicematic_local_items") || "[]");
      const sortedOrders = [...localOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const ordersWithItems = sortedOrders.map((order: any) => {
        const items = localItems.filter((item: any) => item.order_id === order.id);
        return { ...order, items };
      });
      setOrders(ordersWithItems);
    } catch (err: any) {
      console.error("Error loading past orders from Supabase:", err);
      setApiError(`Failed to load orders: ${err.message || err}`);
    } finally {
      setLoadingOrders(false);
    }
  };

  const lookupCustomer = async (phoneStr: string) => {
    setCheckingCustomer(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: customerOrders, error: ordersErr } = await supabase
          .from("orders")
          .select("*")
          .eq("phone", phoneStr);

        if (!ordersErr && customerOrders && customerOrders.length > 0) {
          const sorted = [...customerOrders].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const lastOrder = sorted[0];

          const { data: lastOrderItems, error: itemsErr } = await supabase
            .from("order_items")
            .select("*")
            .eq("order_id", lastOrder.id);

          if (!itemsErr && lastOrderItems) {
            setRepeatCustomer({
              returning: true,
              customer_name: lastOrder.customer_name,
              last_order: {
                ...lastOrder,
                items: lastOrderItems
              },
              order_count: customerOrders.length
            });
            // Pre-fill name if not already typed by user
            if (!customerName.trim()) {
              setCustomerName(lastOrder.customer_name);
            }
            return;
          }
        }
      }

      // Fallback to local storage lookup
      const localOrders = JSON.parse(localStorage.getItem("slicematic_local_orders") || "[]") as Order[];
      const localItems = JSON.parse(localStorage.getItem("slicematic_local_items") || "[]") as OrderItem[];
      const customerOrders = localOrders.filter(o => o.phone === phoneStr);
      
      if (customerOrders.length > 0) {
        const sorted = [...customerOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastOrder = sorted[0];
        const lastOrderItems = localItems.filter(item => item.order_id === lastOrder.id);

        setRepeatCustomer({
          returning: true,
          customer_name: lastOrder.customer_name,
          last_order: {
            ...lastOrder,
            items: lastOrderItems
          },
          order_count: customerOrders.length
        });
        if (!customerName.trim()) {
          setCustomerName(lastOrder.customer_name);
        }
      } else {
        setRepeatCustomer(null);
      }
    } catch (err) {
      console.error("Error checking customer phone:", err);
    } finally {
      setCheckingCustomer(false);
    }
  };

  // Pre-fill combo from last order for returning customer
  const applyLastOrderCombo = () => {
    if (!repeatCustomer || !repeatCustomer.last_order) return;
    const last = repeatCustomer.last_order;
    
    // Find matching items in loaded menu by name
    const lastBase = menu.find(m => m.category === "Base" && last.items.some((li: any) => li.menu_item_name === m.name));
    const lastPizza = menu.find(m => m.category === "Pizza" && last.items.some((li: any) => li.menu_item_name === m.name));
    const lastToppings = menu
      .filter(m => m.category === "Topping" && last.items.some((li: any) => li.menu_item_name === m.name))
      .map(m => m.id);

    if (lastBase) setSelectedBase(lastBase.id);
    if (lastPizza) setSelectedPizza(lastPizza.id);
    setSelectedToppings(lastToppings);
    setQuantity(last.quantity || 1);
    if (last.payment_mode) setPaymentMode(last.payment_mode);
  };

  // Live Calculations (for client-side preview & dynamic basket summary)
  const baseItem = menu.find(m => m.id === selectedBase);
  const pizzaItem = menu.find(m => m.id === selectedPizza);
  const selectedToppingsList = menu.filter(m => selectedToppings.includes(m.id));

  const unitBasePrice = baseItem?.price || 0;
  const unitPizzaPrice = pizzaItem?.price || 0;
  const unitToppingsPrice = selectedToppingsList.reduce((acc, t) => acc + t.price, 0);
  const singlePizzaPrice = unitBasePrice + unitPizzaPrice + unitToppingsPrice;
  const currentConfigSubtotal = singlePizzaPrice * quantity;

  // Auto-added current selection fallback (so single-pizza ordering is seamless)
  const autoAddCurrentSelection = (): BasketItem[] => {
    if (selectedBase && selectedPizza) {
      const bItem = menu.find(m => m.id === selectedBase);
      const pItem = menu.find(m => m.id === selectedPizza);
      const tops = menu.filter(m => selectedToppings.includes(m.id));
      if (bItem && pItem) {
        return [
          {
            id: "basket-auto-temp",
            base_id: selectedBase,
            pizza_id: selectedPizza,
            topping_ids: [...selectedToppings],
            quantity: quantity,
            baseName: bItem.name,
            basePrice: bItem.price,
            pizzaName: pItem.name,
            pizzaPrice: pItem.price,
            toppings: tops.map(t => ({ id: t.id, name: t.name, price: t.price })),
            unitTotal: bItem.price + pItem.price + tops.reduce((sum, t) => sum + t.price, 0)
          }
        ];
      }
    }
    return [];
  };

  const finalBasketList = basket.length > 0 ? basket : autoAddCurrentSelection();
  const totalBasketQty = finalBasketList.reduce((acc, item) => acc + item.quantity, 0);
  const calculatedSubtotal = finalBasketList.reduce((acc, item) => acc + (item.unitTotal * item.quantity), 0);
  
  // Bulk discount: 10% if total quantity >= 5
  const calculatedDiscount = totalBasketQty >= 5 ? parseFloat((calculatedSubtotal * 0.10).toFixed(2)) : 0;
  const calculatedPostDiscount = calculatedSubtotal - calculatedDiscount;
  const calculatedGst = parseFloat((calculatedPostDiscount * 0.18).toFixed(2));
  const calculatedTotal = parseFloat((calculatedPostDiscount + calculatedGst).toFixed(2));

  // Client-side validations
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Customer name validation
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      newErrors.customerName = "Customer name is required.";
    } else if (trimmedName.length < 2 || trimmedName.length > 40) {
      newErrors.customerName = "Name must be between 2 and 40 characters.";
    } else if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      newErrors.customerName = "Name must contain only letters and spaces (no digits or symbols).";
    }

    // Phone validation
    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone) {
      newErrors.customerPhone = "Phone number is required.";
    } else if (trimmedPhone.length !== 10 || !/^\d+$/.test(trimmedPhone)) {
      newErrors.customerPhone = "Phone number must be exactly 10 digits.";
    } else if (!/^[6-9]/.test(trimmedPhone)) {
      newErrors.customerPhone = "Phone number must start with 6, 7, 8, or 9.";
    }

    // Basket Selections Check
    if (finalBasketList.length === 0) {
      newErrors.basket = "Please configure at least one pizza combo and add it to your order.";
    }

    // Payment Mode
    if (!paymentMode) {
      newErrors.paymentMode = "Please select a payment mode.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleTopping = (id: number) => {
    setSelectedToppings(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const handleAddToBasket = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedBase) {
      newErrors.selectedBase = "Please select a crust base.";
    }
    if (!selectedPizza) {
      newErrors.selectedPizza = "Please select a pizza style.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      return;
    }

    const bItem = menu.find(m => m.id === selectedBase);
    const pItem = menu.find(m => m.id === selectedPizza);
    const tops = menu.filter(m => selectedToppings.includes(m.id));

    if (!bItem || !pItem) return;

    const basketItem: BasketItem = {
      id: `basket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      base_id: selectedBase,
      pizza_id: selectedPizza,
      topping_ids: [...selectedToppings],
      quantity: quantity,
      baseName: bItem.name,
      basePrice: bItem.price,
      pizzaName: pItem.name,
      pizzaPrice: pItem.price,
      toppings: tops.map(t => ({ id: t.id, name: t.name, price: t.price })),
      unitTotal: bItem.price + pItem.price + tops.reduce((sum, t) => sum + t.price, 0)
    };

    setBasket(prev => [...prev, basketItem]);

    // Clear config so they can configure another pizza
    setSelectedBase(null);
    setSelectedPizza(null);
    setSelectedToppings([]);
    setQuantity(1);
    setErrors(prev => {
      const updated = { ...prev };
      delete updated.selectedBase;
      delete updated.selectedPizza;
      return updated;
    });
  };

  const handleRemoveFromBasket = (id: string) => {
    setBasket(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateBasketQty = (id: string, newQty: number) => {
    if (newQty < 1 || newQty > 10) return;
    setBasket(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));
  };

  const submitOrder = async () => {
    const finalBasketList = basket.length > 0 ? basket : autoAddCurrentSelection();
    if (!validateForm()) return;

    setSubmittingOrder(true);
    setApiError(null);

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = new Date().toISOString();

    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();

    let totalQty = 0;
    let orderSubtotal = 0;
    const dbOrderItemsPayload: any[] = [];
    const billItemsPayload: any[] = [];

    finalBasketList.forEach((item, i) => {
      const parsedQty = item.quantity;
      totalQty += parsedQty;
      orderSubtotal += item.unitTotal * parsedQty;

      const itemTimePrefix = `${Date.now()}-${i}`;
      
      // Base
      dbOrderItemsPayload.push({
        id: `oi-${itemTimePrefix}-base`,
        order_id: orderId,
        menu_item_name: item.baseName,
        category: "Base",
        unit_price: item.basePrice,
        quantity: parsedQty
      });

      // Pizza Style
      dbOrderItemsPayload.push({
        id: `oi-${itemTimePrefix}-pizza`,
        order_id: orderId,
        menu_item_name: item.pizzaName,
        category: "Pizza",
        unit_price: item.pizzaPrice,
        quantity: parsedQty
      });

      // Toppings
      item.toppings.forEach((t, idx) => {
        dbOrderItemsPayload.push({
          id: `oi-${itemTimePrefix}-top-${idx}`,
          order_id: orderId,
          menu_item_name: t.name,
          category: "Topping",
          unit_price: t.price,
          quantity: parsedQty
        });
      });

      const toppingsDetail = item.toppings.map(t => t.name).join(", ");
      const itemLabel = `${item.baseName} Crust + ${item.pizzaName}${toppingsDetail ? ` (${toppingsDetail})` : ""}`;
      billItemsPayload.push({
        name: `${itemLabel} (x${parsedQty})`,
        price: item.unitTotal * parsedQty,
        category: "Pizza Combo"
      });
    });

    const discount = totalQty >= 5 ? parseFloat((orderSubtotal * 0.10).toFixed(2)) : 0;
    const postDiscountTotal = orderSubtotal - discount;
    const gst = parseFloat((postDiscountTotal * 0.18).toFixed(2));
    const total = parseFloat((postDiscountTotal + gst).toFixed(2));

    const newOrder = {
      id: orderId,
      customer_name: trimmedName,
      phone: trimmedPhone,
      subtotal: orderSubtotal,
      discount,
      gst,
      total,
      payment_mode: paymentMode || "Cash",
      created_at: timestamp
    };

    const bill = {
      customer_name: trimmedName,
      phone: trimmedPhone,
      items: billItemsPayload,
      quantity: totalQty,
      subtotal: orderSubtotal,
      discount,
      gst,
      total,
      payment_mode: paymentMode || "Cash",
      created_at: timestamp
    };

    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Insert into orders
        const { error: orderInsErr } = await supabase
          .from("orders")
          .insert([newOrder]);

        if (orderInsErr) {
          throw orderInsErr;
        }

        // Insert into order_items
        const { error: itemsInsErr } = await supabase
          .from("order_items")
          .insert(dbOrderItemsPayload);

        if (itemsInsErr) {
          throw itemsInsErr;
        }
      } else {
        // Write to local storage fallback
        const localOrders = JSON.parse(localStorage.getItem("slicematic_local_orders") || "[]");
        const localItems = JSON.parse(localStorage.getItem("slicematic_local_items") || "[]");
        
        localOrders.push(newOrder);
        localItems.push(...dbOrderItemsPayload);
        
        localStorage.setItem("slicematic_local_orders", JSON.stringify(localOrders));
        localStorage.setItem("slicematic_local_items", JSON.stringify(localItems));
      }

      // Order submission succeeded!
      setPlacedOrder(bill);
      
      // Clear form states
      setCustomerName("");
      setCustomerPhone("");
      setSelectedBase(null);
      setSelectedPizza(null);
      setSelectedToppings([]);
      setQuantity(1);
      setBasket([]);
      setPaymentMode(null);
      setRepeatCustomer(null);
      setErrors({});
    } catch (err: any) {
      console.error("Order submission error:", err);
      setApiError(err.message || "Failed to submit order. Please check your Supabase connection.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const askAI = async (presetQuestion?: string) => {
    const q = presetQuestion || insightsQuestion;
    if (!q.trim()) return;

    setInsightsLoading(true);
    setInsightsAnswer("");
    try {
      // 1. Gather rich, accurate data context
      const totalSales = orders.reduce((acc, o) => acc + o.total, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const discountGiven = orders.reduce((acc, o) => acc + o.discount, 0);

      const paymentShare: Record<string, number> = {};
      const weekdayOrders: Record<string, number> = {};
      const itemSales: Record<string, number> = {};

      orders.forEach(o => {
        paymentShare[o.payment_mode] = (paymentShare[o.payment_mode] || 0) + 1;
        const date = new Date(o.created_at);
        const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
        weekdayOrders[day] = (weekdayOrders[day] || 0) + 1;
        
        if (o.items) {
          o.items.forEach((item: any) => {
            itemSales[item.menu_item_name] = (itemSales[item.menu_item_name] || 0) + item.quantity;
          });
        }
      });

      const topItems = Object.entries(itemSales)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Check if Gemini API key is configured on client side
      const userKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem("VITE_GEMINI_API_KEY");
      if (userKey) {
        try {
          const payload = {
            contents: [{
              parts: [{
                text: `You are "SliceMatic Insights AI", Rajan Sharma's intelligent business analytics assistant for the SliceMatic pizzeria.
Answer the following owner question: "${q}"

Use this accurate business data:
- Total Store Sales Revenue: ₹${totalSales.toFixed(2)}
- Total Orders Placed: ${totalOrders}
- Average Order Value: ₹${averageOrderValue.toFixed(2)}
- Total Discounts Given: ₹${discountGiven.toFixed(2)}
- Top Selling Items: ${topItems.slice(0, 5).map(i => `${i.name} (${i.count} units)`).join(", ")}
- Payment Modes: ${JSON.stringify(paymentShare)}
- Weekly Sales Trends: ${JSON.stringify(weekdayOrders)}

Guidelines:
1. Be concise, direct, and actionable.
2. Structure with bullet points and bold headers.
3. Keep it professional and pizza-business focused.`
              }]
            }]
          };

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const apiRes = await res.json();
          const answerText = apiRes?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText) {
            setInsightsAnswer(answerText);
            setInsightsLoading(false);
            return;
          }
        } catch (genErr) {
          console.error("Client-side Gemini API call failed, using high-fidelity analytic engine fallback:", genErr);
        }
      }

      // If no key or call failed, run our ultra-polished high-fidelity rule-based analytical engine
      const lowerQ = q.toLowerCase();
      let answer = "";

      if (lowerQ.includes("popular") || lowerQ.includes("item") || lowerQ.includes("selling") || lowerQ.includes("favorite")) {
        if (topItems.length === 0) {
          answer = "### 🍕 Top Selling Items\n\nThere is no order data logged yet to analyze top items. Place some orders first!";
        } else {
          answer = `### 🍕 SliceMatic Item Leaderboard\n\nBased on your historical sales, here is the current demand leaderboard:\n\n` +
            topItems.map((item, idx) => `${idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "•"} **${item.name}**: **${item.count}** units sold`).join("\n") +
            `\n\n**Actionable Insight**: Your highest velocity item is **${topItems[0]?.name || "N/A"}**. Consider bundling this with slow-moving base crust types or promoting it as a special combo to maximize overall profit margin!`;
        }
      } else if (lowerQ.includes("sale") || lowerQ.includes("revenue") || lowerQ.includes("money") || lowerQ.includes("performance") || lowerQ.includes("insights")) {
        answer = `### 📊 Business Performance Summary\n\nHere is your real-time performance dashboard:\n\n` +
          `- **Total Sales Revenue**: ₹${totalSales.toFixed(2)}\n` +
          `- **Total Orders Processed**: ${totalOrders}\n` +
          `- **Average Order Value (AOV)**: ₹${averageOrderValue.toFixed(2)}\n` +
          `- **Total Promotions Granted**: ₹${discountGiven.toFixed(2)}\n\n` +
          `**Analysis**: ` +
          (totalSales > 1500 
            ? `Your business is showing healthy activity with an average order size of ₹${averageOrderValue.toFixed(2)}. The 10% bulk discount has motivated larger volume orders!` 
            : `Store activity is in the early stages. Encourage larger basket sizes by promoting our **10% bulk discount** for orders with 5 or more pizzas!`);
      } else if (lowerQ.includes("payment") || lowerQ.includes("upi") || lowerQ.includes("cash") || lowerQ.includes("card")) {
        const paymentShareStr = Object.entries(paymentShare)
          .map(([mode, count]) => `- **${mode}**: ${count} orders (${((count / totalOrders) * 100).toFixed(0)}%)`)
          .join("\n");

        answer = `### 💳 Payment Mode Distribution\n\nHere is the breakdown of preferred payment methods selected by your customers:\n\n` +
          (totalOrders > 0 ? paymentShareStr : "No payment logs recorded yet.") +
          `\n\n**Actionable Insight**: ` +
          (paymentShare["UPI"] && paymentShare["UPI"] > (totalOrders / 2)
            ? "UPI is your absolute dominant payment mode. Ensure your QR codes are clearly visible at the billing counter to keep queue processing times under 30 seconds."
            : "Keep all three payment options active. Offering diverse payment methods (UPI, Card, Cash) prevents purchase friction at checkout.");
      } else {
        // General smart response that adapts to current store metrics
        answer = `### 💡 SliceMatic Insights Report\n\nHello Rajan, thank you for checking in on your business. Here is a custom performance outline based on your real-time store metrics:\n\n` +
          `- **Velocity**: You have logged **${totalOrders} orders** in total, yielding **₹${totalSales.toFixed(2)}** in gross revenue.\n` +
          `- **Top Performer**: The most popular item is **${topItems[0]?.name || "None yet"}**.\n` +
          `- **Transaction Profile**: Customer tickets average **₹${averageOrderValue.toFixed(2)}** per order.\n\n` +
          `*Tip: If you'd like custom natural language processing with Gemini, add a \`VITE_GEMINI_API_KEY\` to your environment.*`;
      }

      setInsightsAnswer(answer);
    } catch (err: any) {
      console.error("Analytic generation error:", err);
      setInsightsAnswer("Analytics currently unavailable. Try placing a few orders first to seed the statistics!");
    } finally {
      setInsightsLoading(false);
    }
  };

  // Pre-calculate admin view cards
  const stats = {
    totalSales: orders.reduce((sum, o) => sum + o.total, 0),
    orderCount: orders.length,
    avgOrder: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0,
    discountGiven: orders.reduce((sum, o) => sum + o.discount, 0)
  };

  return (
    <div className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 pb-16">
      {/* HEADER SECTION */}
      <header className="bg-slate-900 text-white shadow-xl py-6 px-4 md:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl shadow-lg shadow-amber-500/10">
              <Pizza className="w-8 h-8 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight font-display flex items-center gap-2">
                SliceMatic
              </h1>
            </div>
          </div>

          <div className="flex gap-2 bg-slate-850 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setActiveTab("order")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "order" 
                  ? "bg-amber-500 text-slate-950 shadow-md" 
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Order Intake Form
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "admin" 
                  ? "bg-amber-500 text-slate-950 shadow-md" 
                  : "text-slate-300 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Admin & Sales Insights
            </button>
          </div>
        </div>
      </header>

      {/* ERROR NOTICE */}
      {apiError && (
        <div className="max-w-7xl mx-auto mt-6 w-full px-4">
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-rose-900 font-semibold text-sm">System Connection Warning</h3>
              <p className="text-rose-700 text-xs mt-0.5">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 mt-8 flex-grow">
        
        {/* NEW DEDICATED INVOICE PAGE */}
        {placedOrder ? (
          <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fade-in">
            <div className="text-center space-y-3">
              <div className="inline-flex bg-emerald-500 text-white p-4 rounded-full shadow-lg shadow-emerald-500/20">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 font-display">Order Placed Successfully!</h2>
              <p className="text-slate-500 text-sm">Your order has been logged and sent directly to the kitchen.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-slate-900 text-white p-6 border-b border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pizza className="w-6 h-6 text-amber-500 animate-pulse" />
                  <span className="font-bold text-lg font-display tracking-wider">OFFICIAL INVOICE</span>
                </div>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase">
                  PAID ({placedOrder.payment_mode})
                </span>
              </div>

              <div className="p-6 md:p-8 font-mono text-xs text-slate-700 space-y-6">
                <div className="border-b border-dashed border-slate-200 pb-4 text-center">
                  <h4 className="font-bold text-lg text-slate-900 tracking-widest">SLICEMATIC PIZZERIA</h4>
                  <p className="text-[10px] text-slate-400 mt-1">100% FRESHLY BAKED COMBOS • CHANDIGARH</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">EST. 2026</p>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs border-b border-slate-100 pb-4 text-left">
                  <span className="text-slate-400">Invoice Number:</span>
                  <span className="font-bold text-slate-900 text-right">#SM-{placedOrder.created_at ? placedOrder.created_at.substring(17, 23) || "9812" : "9812"}</span>
                  
                  <span className="text-slate-400">Date & Time:</span>
                  <span className="font-medium text-slate-850 text-right">{new Date(placedOrder.created_at).toLocaleString()}</span>
                  
                  <span className="text-slate-400">Customer Name:</span>
                  <span className="font-bold text-slate-900 text-right">{placedOrder.customer_name}</span>
                  
                  <span className="text-slate-400">Phone Number:</span>
                  <span className="font-bold text-slate-900 text-right">{placedOrder.phone}</span>

                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-bold text-amber-600 text-right">{placedOrder.payment_mode}</span>
                </div>

                <div className="space-y-3 text-left">
                  <p className="font-bold text-slate-900 tracking-wider">ITEMS PURCHASED:</p>
                  <div className="space-y-2">
                    {placedOrder.items.map((it: any, index: number) => (
                      <div key={index} className="flex justify-between pl-2">
                        <span className="text-slate-600">{it.name} ({it.category})</span>
                        <span className="font-bold text-slate-900">₹{it.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-200 pt-4 space-y-2 text-right">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Order Quantity:</span>
                    <span className="font-bold text-slate-900">{placedOrder.quantity}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-bold text-slate-900 font-mono">₹{placedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  {placedOrder.discount > 0 && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Bulk Discount (10%):</span>
                      <span className="font-mono">-₹{placedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST (18% on post-disc):</span>
                    <span className="font-bold text-slate-900 font-mono">₹{placedOrder.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-slate-900">
                    <span className="font-display tracking-wider text-xs uppercase text-slate-500">TOTAL PAYABLE:</span>
                    <span className="text-emerald-600 text-lg font-mono">₹{placedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-dashed border-slate-200 text-[10px] text-slate-400 space-y-1 font-sans">
                  <p>Thank you for dining with SliceMatic! 🍕</p>
                  <p>For support or cancellations, contact +91 98765 43210</p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => setPlacedOrder(null)}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-sm tracking-wider uppercase font-sans"
              >
                <ShoppingBag className="w-4.5 h-4.5" />
                Place Another Order
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "order" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* COLUMN 1 & 2: INTAKE & SELECTION */}
            <div className="lg:col-span-2 space-y-6">

              {/* SECTION: CUSTOMER INTAKE */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold font-display text-slate-800">1. Customer Intake Verification</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Customer Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Rajan Sharma"
                        className={`w-full bg-slate-50 border ${errors.customerName ? "border-rose-500 focus:ring-rose-200" : "border-slate-200 focus:ring-amber-200"} focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-4`}
                      />
                    </div>
                    {errors.customerName && (
                      <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.customerName}
                      </span>
                    )}
                  </div>

                  {/* Phone field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">10-Digit Phone Number</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        maxLength={10}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="9876543210"
                        className={`w-full bg-slate-50 border ${errors.customerPhone ? "border-rose-500 focus:ring-rose-200" : "border-slate-200 focus:ring-amber-200"} focus:border-amber-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-4`}
                      />
                      {checkingCustomer && (
                        <div className="absolute right-3 top-3">
                          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    {errors.customerPhone && (
                      <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.customerPhone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Returning Customer Recognition Prompt */}
                {repeatCustomer && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 transition-all animate-fade-in shadow-inner">
                    <div className="bg-amber-100 text-amber-700 p-2 rounded-lg mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-bold text-amber-900 text-sm">Welcome Back, {repeatCustomer.customer_name}! 🌟</h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        You've completed <span className="font-bold">{repeatCustomer.order_count} orders</span> with SliceMatic. 
                        Your last order total was <span className="font-semibold">₹{repeatCustomer.last_order.total.toFixed(2)}</span>.
                      </p>
                      <button 
                        type="button"
                        onClick={applyLastOrderCombo}
                        className="mt-3.5 inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                      >
                        Quick-Reorder Last Combo
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: PIZZA CONFIGURATOR */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Pizza className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-bold font-display text-slate-800">2. Configure Your Pizza Combo</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Step 2 of 4</span>
                </div>

                {loadingMenu ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <span className="text-slate-500 text-sm font-medium">Reading menu text files...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* CATEGORY 1: CRUST BASES */}
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">1. Select Crust Base</label>
                        {errors.selectedBase && <span className="text-rose-500 text-xs font-semibold">{errors.selectedBase}</span>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {menu.filter(m => m.category === "Base").map(b => (
                          <div 
                            key={b.id}
                            onClick={() => setSelectedBase(b.id)}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                              selectedBase === b.id 
                                ? "border-amber-500 bg-amber-50/40 shadow-sm" 
                                : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{b.name}</p>
                              <p className="text-xs text-slate-400 font-medium">Base Menu Item #{b.id}</p>
                            </div>
                            <span className="font-bold text-slate-700 text-sm bg-slate-100/80 py-1 px-2.5 rounded-lg border border-slate-200/50">
                              ₹{b.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CATEGORY 2: PIZZAS */}
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">2. Select Pizza Style</label>
                        {errors.selectedPizza && <span className="text-rose-500 text-xs font-semibold">{errors.selectedPizza}</span>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {menu.filter(m => m.category === "Pizza").map(p => (
                          <div 
                            key={p.id}
                            onClick={() => setSelectedPizza(p.id)}
                            className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                              selectedPizza === p.id 
                                ? "border-amber-500 bg-amber-50/40 shadow-sm" 
                                : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                              <p className="text-xs text-slate-400 font-medium">Pizza Menu Item #{p.id}</p>
                            </div>
                            <span className="font-bold text-slate-700 text-sm bg-slate-100/80 py-1 px-2.5 rounded-lg border border-slate-200/50">
                              ₹{p.price}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CATEGORY 3: TOPPINGS */}
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">3. Add Toppings (Optional)</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {menu.filter(m => m.category === "Topping").map(t => {
                          const isSelected = selectedToppings.includes(t.id);
                          return (
                            <div 
                              key={t.id}
                              onClick={() => handleToggleTopping(t.id)}
                              className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                                isSelected 
                                  ? "border-amber-500 bg-amber-50/30 shadow-sm" 
                                  : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                  isSelected ? "bg-amber-500 border-amber-500 text-slate-950" : "border-slate-300 bg-white"
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span className="font-bold text-slate-850 text-xs">{t.name}</span>
                              </div>
                              <span className="font-semibold text-slate-500 text-xs">₹{t.price}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* SECTION: QUANTITY */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-bold font-display text-slate-800">3. Select Quantity</h2>
                  </div>
                  {errors.quantity && <span className="text-rose-500 text-xs font-semibold">{errors.quantity}</span>}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 py-2">
                  <div className="flex items-center bg-slate-100 rounded-xl p-1 shadow-sm shrink-0">
                    <button 
                      type="button"
                      onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      className="w-12 h-12 flex items-center justify-center font-bold text-xl hover:bg-white rounded-lg transition-all cursor-pointer select-none"
                    >
                      -
                    </button>
                    <span className="w-16 text-center font-bold text-lg text-slate-850 font-mono">
                      {quantity}
                    </span>
                    <button 
                      type="button"
                      onClick={() => setQuantity(prev => Math.min(10, prev + 1))}
                      className="w-12 h-12 flex items-center justify-center font-bold text-xl hover:bg-white rounded-lg transition-all cursor-pointer select-none"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex-grow space-y-1 text-center md:text-left">
                    {quantity >= 5 ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-inner">
                        <Sparkles className="w-3.5 h-3.5" />
                        Qualified for 10% Bulk Discount!
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-medium">
                        Order 5 or more pizzas to auto-apply a <span className="font-bold text-amber-600">10% discount</span>! (Current selection: {quantity})
                      </span>
                    )}
                    {quantity > 10 && (
                      <p className="text-rose-500 font-semibold text-xs mt-1">Maximum 10 pizzas per order limit.</p>
                    )}
                  </div>
                </div>

                {/* ADD TO BASKET BUTTON */}
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-3 justify-between items-center">
                  <div className="text-left">
                    <p className="text-xs text-slate-400 font-medium font-sans">Current Configuration</p>
                    <p className="text-lg font-extrabold text-slate-800 font-mono">₹{currentConfigSubtotal.toFixed(2)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToBasket}
                    disabled={!selectedBase || !selectedPizza}
                    className={`w-full md:w-auto inline-flex items-center justify-center gap-2 font-bold text-xs px-6 py-3.5 rounded-xl shadow-md transition-all uppercase cursor-pointer ${
                      !selectedBase || !selectedPizza
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        : "bg-amber-500 hover:bg-amber-400 text-slate-950 hover:-translate-y-0.5 active:translate-y-0"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Pizza to Basket
                  </button>
                </div>
              </div>

              {/* SECTION: MY BASKET */}
              {basket.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-500" />
                      <h2 className="text-lg font-bold font-display text-slate-800">Your Basket ({basket.length} {basket.length === 1 ? "Pizza" : "Pizzas"})</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBasket([])}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      Clear Basket
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {basket.map((item, idx) => (
                      <div key={item.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 first:pt-1 last:pb-1">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              Combo #{idx + 1}
                            </span>
                            <span className="font-bold text-slate-850 text-sm">
                              {item.pizzaName}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-sans">
                            <span className="font-medium text-slate-600">Crust:</span> {item.baseName} (₹{item.basePrice.toFixed(2)})
                          </p>
                          {item.toppings.length > 0 && (
                            <p className="text-xs text-slate-400 font-sans">
                              <span className="font-medium text-slate-500">Toppings:</span> {item.toppings.map(t => `${t.name} (₹${t.price.toFixed(2)})`).join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                          {/* Basket Quantity Editor */}
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateBasketQty(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-white rounded transition-all cursor-pointer select-none"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-xs text-slate-850 font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateBasketQty(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-white rounded transition-all cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm text-slate-800 font-mono">₹{(item.unitTotal * item.quantity).toFixed(2)}</p>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromBasket(item.id)}
                              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalBasketQty >= 5 ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-xs text-emerald-800 font-medium font-sans">
                        Awesome! Total items ({totalBasketQty}) qualify for a <span className="font-bold text-emerald-700">10% Bulk Discount</span> on your entire order!
                      </p>
                    </div>
                  ) : (
                    <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 flex items-center gap-2 text-slate-600 text-xs font-sans">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Add <span className="font-bold text-slate-800">{5 - totalBasketQty}</span> more pizza(s) to auto-apply a <span className="font-bold text-amber-600">10% discount</span> on the entire order!</span>
                    </div>
                  )}
                  {errors.basket && (
                    <span className="text-xs text-rose-500 font-medium flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.basket}
                    </span>
                  )}
                </div>
              )}

              {/* SECTION: PAYMENT METHOD */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-bold font-display text-slate-800">4. Select Payment Method</h2>
                  </div>
                  {errors.paymentMode && <span className="text-rose-500 text-xs font-semibold">{errors.paymentMode}</span>}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {(["Cash", "Card", "UPI"] as const).map(mode => (
                    <div
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer text-center space-y-2 flex flex-col items-center justify-center ${
                        paymentMode === mode 
                          ? "border-amber-500 bg-amber-50/40 shadow-sm" 
                          : "border-slate-100 hover:border-slate-200 bg-slate-50/20"
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${
                        paymentMode === mode ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm tracking-wide">{mode}</p>
                    </div>
                  ))}
                </div>

                {paymentMode === "UPI" && (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 text-center space-y-3 mt-4 animate-fade-in">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">UPI Instant Payment QR Code</p>
                    <div className="relative inline-block bg-white p-2 rounded-2xl shadow-md border border-amber-100">
                      <img 
                        src="/src/assets/images/slicematic_upi_qr_1783245637654.jpg" 
                        alt="SliceMatic UPI Payment QR Code" 
                        referrerPolicy="no-referrer"
                        className="w-48 h-48 mx-auto rounded-xl object-contain"
                      />
                      <div className="absolute inset-0 border-2 border-amber-500/30 rounded-2xl pointer-events-none animate-pulse"></div>
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <p className="text-slate-700 text-xs font-medium">
                        Scan the QR code with any UPI app (GPay, PhonePe, Paytm, BHIM) to make your payment of <span className="font-bold text-slate-900 font-mono">₹{calculatedTotal.toFixed(2)}</span>.
                      </p>
                      <p className="text-[10px] text-slate-400">Order gets processed instantly upon confirmation.</p>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* COLUMN 3: RECEIPTS & TOTALS */}
            <div className="space-y-6">
              
              {/* LIVE RECEIPT ACCORDION/CARD */}
              <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden shrink-0">
                <div className="absolute right-0 top-0 bg-amber-500/10 w-24 h-24 rounded-full blur-2xl"></div>
                
                <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-5">
                  <Receipt className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-lg font-display tracking-wide">Real-Time Invoice Review</h3>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  
                  {/* Itemized summary */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Receipt Columns</p>
                    
                    {finalBasketList.length > 0 ? (
                      <div className="space-y-3 divide-y divide-slate-800/60 max-h-[220px] overflow-y-auto pr-1">
                        {finalBasketList.map((item, index) => (
                          <div key={item.id} className="pt-2.5 first:pt-0 space-y-1">
                            <div className="flex justify-between font-bold text-slate-200">
                              <span>Combo #{index + 1}: {item.pizzaName} (x{item.quantity})</span>
                              <span>₹{(item.unitTotal * item.quantity).toFixed(2)}</span>
                            </div>
                            <div className="pl-3 space-y-0.5 text-[10px] text-slate-400 leading-relaxed">
                              <p className="font-sans">• Crust: {item.baseName} (₹{item.basePrice.toFixed(2)})</p>
                              {item.toppings.length > 0 && (
                                <p className="font-sans">• Toppings: {item.toppings.map(t => `${t.name} (₹${t.price.toFixed(2)})`).join(", ")}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-500 italic text-xs leading-relaxed">
                        No pizzas in your order yet.<br/>Configure options and add them to basket, or fill crust and style to preview.
                      </div>
                    )}
                  </div>

                  {/* Pricing logic block */}
                  <div className="border-t border-slate-800 pt-4 space-y-2 text-slate-300">
                    <div className="flex justify-between">
                      <span>Total Pizzas:</span>
                      <span className="font-semibold text-slate-100">x{totalBasketQty}</span>
                    </div>

                    <div className="flex justify-between border-t border-slate-800/80 pt-2.5">
                      <span>Subtotal:</span>
                      <span className="font-bold text-slate-100">₹{calculatedSubtotal.toFixed(2)}</span>
                    </div>

                    {calculatedDiscount > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>10% Bulk Discount:</span>
                        <span>-₹{calculatedDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>GST Tax (18%):</span>
                      <span className="font-semibold text-slate-100">₹{calculatedGst.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Grand total */}
                  <div className="border-t-2 border-dashed border-slate-700 pt-4 mt-2">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold font-display text-sm tracking-wider uppercase text-slate-400">TOTAL PAYABLE</span>
                      <span className="text-2xl font-bold font-mono text-amber-500">
                        ₹{calculatedTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={submittingOrder || finalBasketList.length === 0}
                  className={`w-full mt-6 py-4 px-4 rounded-xl font-bold text-sm tracking-wide transition-all uppercase flex items-center justify-center gap-2 cursor-pointer ${
                    submittingOrder || finalBasketList.length === 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                      : "bg-amber-500 text-slate-950 hover:bg-amber-400 active:translate-y-0.5 shadow-lg shadow-amber-500/10"
                  }`}
                >
                  {submittingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Order...
                    </>
                  ) : (
                    <>
                      Submit Order & Invoice
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>



            </div>

          </div>
        )}

        {/* TAB 2: ADMIN & AI INSIGHTS */}
        {activeTab === "admin" && (
          !isAdminLoggedIn ? (
            /* ADMIN LOGIN PANEL */
            <div className="max-w-xl mx-auto my-12 space-y-6">
              {isSupabaseActive && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/20 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in text-left">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-800 font-display flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      Join as a SliceMatic Operator
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Create your official operator account to access the sales insights, customer histories, and advanced AI analytics.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignUpModal(true);
                      setSignUpError("");
                      setSignUpSuccess("");
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Register Operator Account
                  </button>
                </div>
              )}

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-6 animate-fade-in">
                <div className="flex justify-between items-start">
                  <div className="text-left space-y-1">
                    <div className="inline-flex bg-amber-500 text-slate-950 p-3 rounded-2xl shadow-md">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-850 font-display">Operator Console</h2>
                    <p className="text-xs text-slate-400">Authenticating access for SliceMatic operators</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isSupabaseActive ? (
                      <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-spin" />
                        Supabase Connected
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        🔐 Local Demo Auth
                      </span>
                    )}
                  </div>
                </div>

                {adminLoginError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                    <span>{adminLoginError}</span>
                  </div>
                )}

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setAdminLoginError("");
                  
                  if (isSupabaseActive) {
                    const supabase = getSupabaseClient();
                    if (supabase) {
                      setIsAuthenticating(true);
                      try {
                        const { data, error } = await supabase.auth.signInWithPassword({
                          email: adminUsername,
                          password: adminPassword,
                        });
                        if (error) {
                          setAdminLoginError(error.message);
                        } else if (data?.user) {
                          setIsAdminLoggedIn(true);
                          setAdminLoginError("");
                          setAdminUsername("");
                          setAdminPassword("");
                        }
                      } catch (err: any) {
                        setAdminLoginError(err.message || "Authentication failed with Supabase.");
                      } finally {
                        setIsAuthenticating(false);
                      }
                    }
                  } else {
                    if (adminUsername === "admin" && adminPassword === "slicematic_admin") {
                      setIsAdminLoggedIn(true);
                      setAdminLoginError("");
                      setAdminUsername("");
                      setAdminPassword("");
                    } else {
                      setAdminLoginError("Invalid credentials. Try using admin / slicematic_admin.");
                    }
                  }
                }} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                      {isSupabaseActive ? "Admin Email (Supabase)" : "Username"}
                    </label>
                    <input
                      type={isSupabaseActive ? "email" : "text"}
                      required
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder={isSupabaseActive ? "admin@slicematic.com" : "Enter username"}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200 rounded-xl px-4 py-3 text-sm font-medium transition-all focus:outline-none"
                      disabled={isAuthenticating}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Password</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200 rounded-xl px-4 py-3 text-sm font-medium transition-all focus:outline-none"
                      disabled={isAuthenticating}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all uppercase text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying Credentials...
                      </>
                    ) : (
                      <>
                        Log In Securely
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )
                  }</button>
                </form>

                {/* DEMO TIP FOR CONVENIENCE */}
                {!isSupabaseActive && (
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demo Credentials</p>
                    <div className="flex justify-center gap-4 text-xs font-mono text-slate-600 mt-1.5 font-medium">
                      <span>Username: <strong className="text-slate-800">admin</strong></span>
                      <span>Password: <strong className="text-slate-800">slicematic_admin</strong></span>
                    </div>
                  </div>
                )}
              </div>


            </div>
          ) : (
            /* AUTHENTICATED ADMIN DASHBOARD */
            <div className="space-y-8">
              {/* TOP HEADER CONTROLS FOR LOGGED IN ADMIN */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="bg-emerald-500 text-white p-1.5 rounded-lg font-bold text-xs">
                    ACTIVE OPERATOR SESSION
                  </div>
                  <span className="text-sm font-semibold text-amber-900">
                    Logged in as <span className="font-bold">SliceMatic Operator</span>
                  </span>
                </div>
                <button
                  onClick={() => setIsAdminLoggedIn(false)}
                  className="bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Sign Out of Operator Panel
                </button>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Total Sales</span>
                  <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">₹{stats.totalSales.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Order Count</span>
                  <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{stats.orderCount}</span>
                </div>
                <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Average Ticket</span>
                  <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">₹{stats.avgOrder.toFixed(2)}</span>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Discounts Granted</span>
                  <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">₹{stats.discountGiven.toFixed(2)}</span>
                </div>
                <div className="bg-rose-50 text-rose-600 p-3 rounded-xl">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* AI DEMAND ASSISTANT PANEL */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
                <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-display text-slate-100">SliceMatic Insights AI Assistant</h3>
                  <p className="text-slate-400 text-xs">Plain-English Sales, Demand, and Operational analytics for Rajan Sharma</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-2">
                  <input 
                    type="text" 
                    value={insightsQuestion}
                    onChange={(e) => setInsightsQuestion(e.target.value)}
                    placeholder="Ask a question (e.g., 'Which topping sells the most?' or 'What is our peak hour of day?')"
                    className="flex-grow bg-slate-800 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    onClick={() => askAI()}
                    disabled={insightsLoading || !insightsQuestion.trim()}
                    className={`px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all uppercase flex items-center justify-center gap-2 cursor-pointer ${
                      insightsLoading || !insightsQuestion.trim()
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md"
                    }`}
                  >
                    {insightsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Analyze Data
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Preset suggestions */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-slate-500 font-bold self-center mr-1">Suggested Questions:</span>
                  {[
                    "Which topping sells the most?",
                    "What was my busiest day this week?",
                    "What is our peak business hour?",
                    "How much have we made in total sales?"
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInsightsQuestion(preset);
                        askAI(preset);
                      }}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/50 cursor-pointer transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* AI Answer block */}
                {insightsAnswer && (
                  <div className="bg-slate-850 border border-slate-800 p-5 rounded-xl space-y-2 mt-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-widest">
                      <Sparkles className="w-4.5 h-4.5" />
                      AI Analyst Output
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line font-medium border-l-2 border-amber-500/40 pl-4 py-1">
                      {insightsAnswer}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ORDERS LOG TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Historical Order Transactions</h3>
                </div>
                {loadingOrders && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
              </div>

              {orders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-slate-400 text-sm font-medium">No order transactions found.</p>
                  <p className="text-slate-400 text-xs">Log an order in the Intake tab to view transactions.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4">Details</th>
                        <th className="px-6 py-4 text-right">Payment</th>
                        <th className="px-6 py-4 text-right">Total Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(order.created_at).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-300" />
                              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-850 font-bold">{order.customer_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono">{order.phone}</td>
                          <td className="px-6 py-4">
                            <div className="max-w-xs truncate text-slate-600">
                              {order.items?.map(it => `${it.menu_item_name} (x${it.quantity})`).join(", ") || "Combo pizza"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-[10px] font-bold">
                              {order.payment_mode}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-slate-900 font-bold font-mono">
                            ₹{order.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )
      )}
          </>
        )}

      </main>

      {/* SIGN UP MODAL */}
      {showSignUpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden relative p-8 space-y-6 transform transition-all">
            <div className="text-left space-y-1">
              <div className="inline-flex bg-amber-500 text-slate-950 p-3 rounded-2xl shadow-md">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-slate-850 font-display">Register Operator Account</h3>
              <p className="text-xs text-slate-400">Join the SliceMatic system as an authorized pizzeria operator</p>
            </div>

            {signUpError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                <span>{signUpError}</span>
              </div>
            )}

            {signUpSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-medium">
                <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span>{signUpSuccess}</span>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setSignUpError("");
              setSignUpSuccess("");

              if (signUpPassword !== signUpConfirmPassword) {
                setSignUpError("Passwords do not match.");
                return;
              }

              if (signUpPassword.length < 6) {
                setSignUpError("Password must be at least 6 characters.");
                return;
              }

              const supabase = getSupabaseClient();
              if (!supabase) {
                setSignUpError("Supabase is not configured.");
                return;
              }

              setSignUpLoading(true);
              try {
                const { data, error } = await supabase.auth.signUp({
                  email: signUpEmail,
                  password: signUpPassword,
                  options: {
                    emailRedirectTo: "https://ai.studio/apps/e2d04ca4-ebba-4d04-a9ba-b2a4bebbccb9",
                  },
                });

                if (error) {
                  setSignUpError(error.message);
                } else {
                  if (data?.session) {
                    setSignUpSuccess("Registration successful! You are now logged in.");
                    setIsAdminLoggedIn(true);
                  } else {
                    setSignUpSuccess("Registration success! Check your email for a confirmation link to complete registration.");
                  }
                  setSignUpEmail("");
                  setSignUpPassword("");
                  setSignUpConfirmPassword("");
                  // Close modal after brief delay
                  setTimeout(() => {
                    setShowSignUpModal(false);
                    setSignUpSuccess("");
                  }, 4000);
                }
              } catch (err: any) {
                setSignUpError(err.message || "An unexpected error occurred.");
              } finally {
                setSignUpLoading(false);
              }
            }} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Email Address</label>
                <input
                  type="email"
                  required
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="operator@slicematic.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200 rounded-xl px-4 py-3 text-sm font-medium transition-all focus:outline-none"
                  disabled={signUpLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Password</label>
                <input
                  type="password"
                  required
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200 rounded-xl px-4 py-3 text-sm font-medium transition-all focus:outline-none"
                  disabled={signUpLoading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={signUpConfirmPassword}
                  onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200 rounded-xl px-4 py-3 text-sm font-medium transition-all focus:outline-none"
                  disabled={signUpLoading}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignUpModal(false)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all text-xs tracking-wide uppercase cursor-pointer"
                  disabled={signUpLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide uppercase flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  disabled={signUpLoading}
                >
                  {signUpLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      Sign Up
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
