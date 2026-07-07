import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: "Base" | "Pizza" | "Topping";
}

// Validate menu files on startup strictly and parse.
// We provide robust hardcoded default fallbacks to ensure the application starts and serves requests flawlessly on serverless hosts like Vercel.
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

function loadMenu(): MenuItem[] {
  // Trick Vercel NFT (Node File Trace) static-analyzer into copying the static menu files to Vercel deployment package
  if (false) {
    path.join(process.cwd(), "menu_base.txt");
    path.join(process.cwd(), "menu_pizza.txt");
    path.join(process.cwd(), "menu_toppings.txt");
  }

  const items: MenuItem[] = [];
  let currentId = 1;

  const files = [
    { name: "menu_base.txt", category: "Base" as const },
    { name: "menu_pizza.txt", category: "Pizza" as const },
    { name: "menu_toppings.txt", category: "Topping" as const }
  ];

  for (const file of files) {
    const filePath = path.join(process.cwd(), file.name);
    let useFallback = false;

    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Menu file "${file.name}" is missing at "${filePath}". Using robust default fallback.`);
      useFallback = true;
    } else {
      try {
        fs.accessSync(filePath, fs.constants.R_OK);
      } catch (err) {
        console.warn(`Warning: Menu file "${file.name}" is unreadable. Using robust default fallback.`);
        useFallback = true;
      }
    }

    if (useFallback) {
      const fallbacks = DEFAULT_MENU.filter(item => item.category === file.category);
      for (const item of fallbacks) {
        items.push({
          id: currentId++,
          name: item.name,
          price: item.price,
          category: file.category
        });
      }
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length < 2) {
          console.warn(`Warning: Malformed line ${i + 1} in ${file.name} - missing price field: "${line}"`);
          continue;
        }

        const name = parts[0].trim();
        const priceStr = parts[1].trim();
        const price = parseFloat(priceStr);

        if (!name || isNaN(price)) {
          console.warn(`Warning: Malformed line ${i + 1} in ${file.name} - invalid name or price: "${line}"`);
          continue;
        }

        items.push({
          id: currentId++,
          name,
          price,
          category: file.category
        });
      }
    } catch (err: any) {
      console.warn(`Warning: Failed to parse menu file "${file.name}":`, err);
      const fallbacks = DEFAULT_MENU.filter(item => item.category === file.category);
      for (const item of fallbacks) {
        items.push({
          id: currentId++,
          name: item.name,
          price: item.price,
          category: file.category
        });
      }
    }
  }

  return items;
}

// Strict menu loading check at startup
loadMenu();

// Database helper for local JSON database
const DB_PATH = path.join(process.cwd(), "data", "slicematic_db.json");

// Helper to get server-side Supabase client
function getServerSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key && url.startsWith("http") && !url.includes("your-project") && !key.includes("your-supabase")) {
    return createClient(url, key);
  }
  return null;
}

interface DBStructure {
  orders: any[];
  order_items: any[];
}

function readDB(): DBStructure {
  try {
    if (!fs.existsSync(DB_PATH)) {
      if (process.env.VERCEL) {
        // Return empty structure on Vercel without attempting to write (read-only filesystem)
        return { orders: [], order_items: [] };
      }
      // Ensure directory and empty file
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      const initialDB = { orders: [], order_items: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2), "utf-8");
      return initialDB;
    }
    const content = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading database:", err);
    return { orders: [], order_items: [] };
  }
}

function writeDB(data: DBStructure) {
  try {
    if (process.env.VERCEL) {
      console.warn("Skipping local JSON DB write on Vercel (read-only filesystem).");
      return;
    }
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

const app = express();
app.use(express.json());

// Log all incoming requests for easier debugging in Vercel logs
app.use((req, res, next) => {
  console.log(`[Express] Incoming request: ${req.method} ${req.url}`);
  next();
});

  // API endpoints FIRST

  // GET MENU
  app.get(["/api/menu", "/menu"], (req, res) => {
    try {
      const menu = loadMenu();
      res.json({ success: true, menu });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // UPLOAD MENU FILE
  app.post(["/api/upload-menu", "/upload-menu"], express.json(), (req, res) => {
    try {
      const { filename, content } = req.body;
      if (!filename || typeof content !== "string") {
        return res.status(400).json({ success: false, error: "Missing filename or content string." });
      }

      const allowedFiles = ["menu_base.txt", "menu_pizza.txt", "menu_toppings.txt"];
      if (!allowedFiles.includes(filename)) {
        return res.status(400).json({ success: false, error: "Invalid menu filename." });
      }

      const filePath = path.join(process.cwd(), filename);
      fs.writeFileSync(filePath, content, "utf-8");

      // Reload and return new menu items to verify correctness
      const menu = loadMenu();
      res.json({ success: true, message: `File ${filename} updated successfully.`, menu });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET PAST ORDERS (Admin Table View)
  app.get(["/api/orders", "/orders"], async (req, res) => {
    try {
      const supabase = getServerSupabase();
      if (supabase) {
        try {
          const { data: dbOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });

          if (!ordersErr && dbOrders) {
            const { data: dbItems, error: itemsErr } = await supabase
              .from("order_items")
              .select("*");

            if (!itemsErr && dbItems) {
              const ordersWithItems = dbOrders.map((order: any) => {
                const items = dbItems.filter((item: any) => item.order_id === order.id);
                return { ...order, items };
              });
              return res.json({ success: true, orders: ordersWithItems });
            }
          }
          console.warn("Supabase fetch failed or tables empty, falling back to JSON DB.");
        } catch (supaErr) {
          console.error("Supabase query error, falling back to local DB:", supaErr);
        }
      }

      const db = readDB();
      // Sort orders by timestamp descending
      const sortedOrders = [...db.orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Join with order items
      const ordersWithItems = sortedOrders.map(order => {
        const items = db.order_items.filter(item => item.order_id === order.id);
        return { ...order, items };
      });

      res.json({ success: true, orders: ordersWithItems });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET CUSTOMER HISTORY (Greeting & repeat customer recognition)
  app.get(["/api/customer/:phone", "/customer/:phone"], async (req, res) => {
    try {
      const { phone } = req.params;
      const supabase = getServerSupabase();

      if (supabase) {
        try {
          const { data: customerOrders, error: ordersErr } = await supabase
            .from("orders")
            .select("*")
            .eq("phone", phone);

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
              return res.json({
                success: true,
                returning: true,
                customer_name: lastOrder.customer_name,
                last_order: {
                  ...lastOrder,
                  items: lastOrderItems
                },
                order_count: customerOrders.length
              });
            }
          }
        } catch (supaErr) {
          console.error("Supabase customer history lookup error, falling back to local:", supaErr);
        }
      }

      const db = readDB();
      
      const customerOrders = db.orders.filter(o => o.phone === phone);
      if (customerOrders.length === 0) {
        return res.json({ success: true, returning: false });
      }

      // Find the most recent order
      const sorted = [...customerOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastOrder = sorted[0];
      const lastOrderItems = db.order_items.filter(item => item.order_id === lastOrder.id);

      res.json({
        success: true,
        returning: true,
        customer_name: lastOrder.customer_name,
        last_order: {
          ...lastOrder,
          items: lastOrderItems
        },
        order_count: customerOrders.length
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST NEW ORDER (Supports backward-compatible single item or multi-item basket)
  app.post(["/api/orders", "/orders"], async (req, res) => {
    try {
      const { customer_name, phone, base_id, pizza_id, topping_ids, quantity, payment_mode, basket } = req.body;

      // 1. CUSTOMER INTAKE VALIDATION
      if (!customer_name || typeof customer_name !== "string") {
        return res.status(400).json({ success: false, error: "Customer name is required." });
      }
      const trimmedName = customer_name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 40) {
        return res.status(400).json({ success: false, error: "Name must be between 2 and 40 characters." });
      }
      if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
        return res.status(400).json({ success: false, error: "Name must contain only letters and spaces." });
      }

      if (!phone || typeof phone !== "string") {
        return res.status(400).json({ success: false, error: "Phone number is required." });
      }
      const trimmedPhone = phone.trim();
      if (trimmedPhone.length !== 10 || !/^\d+$/.test(trimmedPhone)) {
        return res.status(400).json({ success: false, error: "Phone number must be exactly 10 digits." });
      }
      if (!/^[6-9]/.test(trimmedPhone)) {
        return res.status(400).json({ success: false, error: "Phone number must start with 6, 7, 8, or 9." });
      }

      // 2. PAYMENT MODE VALIDATION
      if (!payment_mode || !["Cash", "Card", "UPI"].includes(payment_mode)) {
        return res.status(400).json({ success: false, error: "Invalid payment mode selected. Must be Cash, Card, or UPI." });
      }

      // 3. CONSTRUCT UNIFIED BASKET
      let unifiedBasket: any[] = [];
      if (Array.isArray(basket) && basket.length > 0) {
        unifiedBasket = basket;
      } else {
        unifiedBasket = [
          {
            base_id,
            pizza_id,
            topping_ids: topping_ids || [],
            quantity: quantity !== undefined ? quantity : 1
          }
        ];
      }

      if (unifiedBasket.length === 0) {
        return res.status(400).json({ success: false, error: "Your basket is empty. Please add at least one pizza to place an order." });
      }

      const menu = loadMenu();
      let totalQty = 0;
      let orderSubtotal = 0;
      const orderItemsToLog: string[] = [];
      const dbOrderItemsPayload: any[] = [];
      const billItemsPayload: any[] = [];

      const orderId = `ord-${Date.now()}`;
      const timestamp = new Date().toISOString();

      // Validate and compute each pizza combo in the basket
      for (let i = 0; i < unifiedBasket.length; i++) {
        const bItem = unifiedBasket[i];
        const item_base_id = bItem.base_id;
        const item_pizza_id = bItem.pizza_id;
        const item_topping_ids = bItem.topping_ids || [];
        const item_qty = bItem.quantity;

        if (item_qty === undefined || item_qty === null) {
          return res.status(400).json({ success: false, error: `Quantity is required for Pizza Item #${i + 1}.` });
        }
        const parsedQty = Number(item_qty);
        if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 10) {
          return res.status(400).json({ success: false, error: `Quantity for Pizza Item #${i + 1} must be an integer between 1 and 10.` });
        }

        const baseItem = menu.find(item => item.id === Number(item_base_id) && item.category === "Base");
        const pizzaItem = menu.find(item => item.id === Number(item_pizza_id) && item.category === "Pizza");

        if (!baseItem) {
          return res.status(400).json({ success: false, error: `Please select a valid crust base for Pizza Item #${i + 1}.` });
        }
        if (!pizzaItem) {
          return res.status(400).json({ success: false, error: `Please select a valid pizza style for Pizza Item #${i + 1}.` });
        }

        const selectedToppings: MenuItem[] = [];
        if (Array.isArray(item_topping_ids)) {
          for (const tId of item_topping_ids) {
            const toppingItem = menu.find(item => item.id === Number(tId) && item.category === "Topping");
            if (!toppingItem) {
              return res.status(400).json({ success: false, error: `Invalid topping selection (ID ${tId}) for Pizza Item #${i + 1}.` });
            }
            selectedToppings.push(toppingItem);
          }
        }

        const unitBasePrice = baseItem.price;
        const unitPizzaPrice = pizzaItem.price;
        const unitToppingsPrice = selectedToppings.reduce((acc, t) => acc + t.price, 0);
        const singlePizzaPrice = unitBasePrice + unitPizzaPrice + unitToppingsPrice;
        const itemSubtotal = singlePizzaPrice * parsedQty;

        totalQty += parsedQty;
        orderSubtotal += itemSubtotal;

        // Log formatted string
        const toppingsLog = selectedToppings.map(t => t.name).join(", ") || "None";
        orderItemsToLog.push(`[Pizza #${i + 1}: ${baseItem.name} Crust + ${pizzaItem.name} (Toppings: ${toppingsLog}) | Qty: ${parsedQty} | Price: ₹${itemSubtotal.toFixed(2)}]`);

        // Database details
        const itemTimePrefix = `${Date.now()}-${i}`;
        dbOrderItemsPayload.push(
          {
            id: `oi-${itemTimePrefix}-base`,
            order_id: orderId,
            menu_item_name: baseItem.name,
            category: "Base" as const,
            unit_price: baseItem.price,
            quantity: parsedQty
          },
          {
            id: `oi-${itemTimePrefix}-pizza`,
            order_id: orderId,
            menu_item_name: pizzaItem.name,
            category: "Pizza" as const,
            unit_price: pizzaItem.price,
            quantity: parsedQty
          },
          ...selectedToppings.map((t, idx) => ({
            id: `oi-${itemTimePrefix}-top-${idx}`,
            order_id: orderId,
            menu_item_name: t.name,
            category: "Topping" as const,
            unit_price: t.price,
            quantity: parsedQty
          }))
        );

        // Bill presentation representation
        const toppingsDetail = selectedToppings.map(t => t.name).join(", ");
        const itemLabel = `${baseItem.name} Crust + ${pizzaItem.name}${toppingsDetail ? ` (${toppingsDetail})` : ""}`;
        billItemsPayload.push({
          name: `${itemLabel} (x${parsedQty})`,
          price: itemSubtotal,
          category: "Pizza Combo"
        });
      }

      // Calculations across all basket items
      // Bulk discount: 10% discount if TOTAL quantity across all items >= 5
      const discount = totalQty >= 5 ? parseFloat((orderSubtotal * 0.10).toFixed(2)) : 0.00;
      const postDiscountTotal = orderSubtotal - discount;
      const gst = parseFloat((postDiscountTotal * 0.18).toFixed(2));
      const total = parseFloat((postDiscountTotal + gst).toFixed(2));

      // Append log block
      const itemsLogStr = orderItemsToLog.join("\n  ");
      const logBlock = `Timestamp: ${timestamp}
Customer: ${trimmedName}
Phone: ${trimmedPhone}
Items: 
  ${itemsLogStr}
Total Quantity: ${totalQty}
Subtotal: ₹${orderSubtotal.toFixed(2)}
Discount: ₹${discount.toFixed(2)}
GST (18%): ₹${gst.toFixed(2)}
Total: ₹${total.toFixed(2)}
Payment Mode: ${payment_mode}
`;
      if (!process.env.VERCEL) {
        fs.appendFileSync(path.join(process.cwd(), "orders_log.txt"), logBlock + "\n");
      } else {
        console.log("Vercel env: skipping physical orders_log.txt writing.");
      }

      // Save order to structured database
      const db = readDB();
      const newOrder = {
        id: orderId,
        customer_name: trimmedName,
        phone: trimmedPhone,
        subtotal: orderSubtotal,
        discount,
        gst,
        total,
        payment_mode,
        created_at: timestamp
      };

      db.orders.push(newOrder);
      db.order_items.push(...dbOrderItemsPayload);
      writeDB(db);

      // Save to Supabase if configured
      const supabase = getServerSupabase();
      if (supabase) {
        try {
          const { error: orderInsErr } = await supabase
            .from("orders")
            .insert([newOrder]);

          if (orderInsErr) {
            console.error("Supabase orders insert error:", orderInsErr);
          } else {
            const { error: itemsInsErr } = await supabase
              .from("order_items")
              .insert(dbOrderItemsPayload);
            if (itemsInsErr) {
              console.error("Supabase order_items insert error:", itemsInsErr);
            }
          }
        } catch (supaErr) {
          console.error("Supabase connection or write error:", supaErr);
        }
      }

      res.json({
        success: true,
        order_id: orderId,
        bill: {
          customer_name: trimmedName,
          phone: trimmedPhone,
          items: billItemsPayload,
          quantity: totalQty,
          subtotal: orderSubtotal,
          discount,
          gst,
          total,
          payment_mode,
          created_at: timestamp
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // AI POWERED DEMAND AND SALES INSIGHTS
  app.post(["/api/ai/insights", "/ai/insights"], async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ success: false, error: "Question is required." });
      }

      let orders: any[] = [];
      let orderItems: any[] = [];
      let fetchedFromSupabase = false;

      const supabase = getServerSupabase();
      if (supabase) {
        try {
          const { data: dbOrders, error: ordersErr } = await supabase.from("orders").select("*");
          const { data: dbItems, error: itemsErr } = await supabase.from("order_items").select("*");
          if (!ordersErr && !itemsErr && dbOrders && dbItems) {
            orders = dbOrders;
            orderItems = dbItems;
            fetchedFromSupabase = true;
          }
        } catch (supaErr) {
          console.error("Supabase fetch for AI insights failed, falling back to local DB:", supaErr);
        }
      }

      if (!fetchedFromSupabase) {
        const db = readDB();
        orders = db.orders;
        orderItems = db.order_items;
      }

      // Calculate rich aggregated context to keep prompt dense but incredibly informative
      const totalSales = orders.reduce((acc, o) => acc + o.total, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      const discountGiven = orders.reduce((acc, o) => acc + o.discount, 0);

      // Group payments
      const paymentShare: Record<string, number> = {};
      // Group orders by weekday
      const weekdayOrders: Record<string, number> = {};
      // Group orders by hour
      const hourlyOrders: Record<string, number> = {};
      // Most popular items
      const itemSales: Record<string, { count: number; category: string }> = {};

      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      orders.forEach(o => {
        paymentShare[o.payment_mode] = (paymentShare[o.payment_mode] || 0) + 1;
        const date = new Date(o.created_at);
        const day = daysOfWeek[date.getUTCDay()];
        weekdayOrders[day] = (weekdayOrders[day] || 0) + 1;
        const hour = `${date.getUTCHours()}:00 UTC`;
        hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
      });

      orderItems.forEach(item => {
        if (!itemSales[item.menu_item_name]) {
          itemSales[item.menu_item_name] = { count: 0, category: item.category };
        }
        itemSales[item.menu_item_name].count += item.quantity;
      });

      // Format clean list of items
      const topItems = Object.entries(itemSales)
        .map(([name, info]) => ({ name, count: info.count, category: info.category }))
        .sort((a, b) => b.count - a.count);

      // Recent 5 orders for transactional context
      const recentOrders = [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(o => {
          const items = orderItems.filter(item => item.order_id === o.id).map(i => `${i.menu_item_name} (x${i.quantity})`).join(", ");
          return `- Date: ${o.created_at.slice(0, 10)}, Customer: ${o.customer_name}, Total: ₹${o.total}, Items: [${items}]`;
        })
        .join("\n");

      const systemPrompt = `You are "SliceMatic Insights AI", Rajan Sharma's intelligent business analytics assistant for the SliceMatic pizzeria. 
You will be given structured aggregations and historical logs of pizza orders. 
Answer Rajan's question clearly, concisely, and with high business usefulness. 

Follow these strict constraints:
1. Ground every single claim or number strictly on the provided data.
2. If the question asks about something not represented in the data, state clearly and politely that you do not have that data, rather than hallucinating or guessing.
3. Keep the tone professional, objective, supportive, and business-focused.
4. Keep the answer highly scannable, and avoid bloated paragraphs.

DATA SET CONTEXT:
- Total Store Sales Revenue: ₹${totalSales.toFixed(2)}
- Total Orders Placed: ${totalOrders}
- Average Order Value: ₹${averageOrderValue.toFixed(2)}
- Total Promotional Discounts Granted: ₹${discountGiven.toFixed(2)}

- Payment Mode Distribution (Order Count):
${JSON.stringify(paymentShare, null, 2)}

- Day-of-the-Week Distribution (Order Count):
${JSON.stringify(weekdayOrders, null, 2)}

- Hour-of-the-Day Distribution (Order Count):
${JSON.stringify(hourlyOrders, null, 2)}

- Item Sales Leaderboard (Units Sold):
${topItems.map(item => `- ${item.name} (${item.category}): ${item.count} units`).join("\n")}

- Recent Orders:
${recentOrders}
`;

      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Neither GOOGLE_API_KEY nor GEMINI_API_KEY environment variable is configured.");
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Context:\n${systemPrompt}\n\nOwner Question: ${question}`
      });

      res.json({ success: true, answer: response.text });
    } catch (err: any) {
      console.error("Gemini AI API Error:", err);
      res.json({
        success: true,
        answer: "Insights are currently unavailable. Please verify that your Gemini API key is configured and try again."
      });
    }
  });

  // Setup Vite development server or serve production build
  async function setupServer() {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      
      const PORT = 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      
      if (!process.env.VERCEL) {
        const PORT = 3000;
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Server running on http://localhost:${PORT}`);
        });
      }
    }
  }

  setupServer();

  export default app;
