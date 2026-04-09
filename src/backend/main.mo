import List "mo:core/List";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Iter "mo:core/Iter";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";
import Outcall "mo:caffeineai-http-outcalls/outcall";
import Migration "migration";

(with migration = Migration.run)
actor {

  // ── Types ──────────────────────────────────────────────────────────────────

  public type ExpenseCategory = {
    #Food;
    #Shopping;
    #Transport;
    #Bills;
    #Entertainment;
    #Health;
    #Travel;
    #Other;
  };

  public type PaymentMethod = {
    #Cash;
    #Card;
    #UPI;
    #NetBanking;
    #Other;
  };

  public type RiskLevel = {
    #Low;
    #Medium;
    #High;
  };

  public type AlertStatus = {
    #Active;
    #Dismissed;
  };

  public type Expense = {
    id : Nat;
    amount : Float;
    merchant : Text;
    date : Text;
    category : ExpenseCategory;
    paymentMethod : PaymentMethod;
    note : Text;
    source : Text;
    createdAt : Int;
    updatedAt : ?Int;
    callerId : Principal;
  };

  public type ExpenseInput = {
    amount : Float;
    merchant : Text;
    date : Text;
    category : ExpenseCategory;
    paymentMethod : PaymentMethod;
    note : Text;
    source : Text;
  };

  public type ExpenseUpdateInput = {
    amount : ?Float;
    merchant : ?Text;
    date : ?Text;
    category : ?ExpenseCategory;
    paymentMethod : ?PaymentMethod;
    note : ?Text;
  };

  public type ExpenseSummary = {
    total : Float;
    count : Nat;
    thisMonthTotal : Float;
    thisMonthCount : Nat;
    topCategory : Text;
    avgExpense : Float;
  };

  public type BudgetStatus = {
    budget : Float;
    spent : Float;
    remaining : Float;
    percentage : Float;
  };

  public type UserProfile = {
    name : Text;
    email : Text;
    monthlyBudget : Float;
    currency : Text;
  };

  public type UserProfileInput = UserProfile;

  public type ThemePreference = {
    palette : Text;
    mode : Text;
    customColor : ?Text;
  };

  public type ThemeOption = {
    id : Text;
    name : Text;
    description : Text;
  };

  public type DocumentMeta = {
    id : Nat;
    name : Text;
    fileType : Text;
    uploadedAt : Int;
    size : Nat;
    callerId : Principal;
  };

  public type DocumentMetaInput = {
    name : Text;
    fileType : Text;
    size : Nat;
  };

  public type ChatEntry = {
    id : Nat;
    role : Text;
    content : Text;
    timestamp : Int;
    callerId : Principal;
  };

  public type ChatEntryInput = {
    role : Text;
    content : Text;
  };

  public type ChatRequest = {
    message : Text;
    context : Text;
  };

  public type ChatResponse = {
    response : Text;
    timestamp : Int;
  };

  public type SpendingAlert = {
    category : Text;
    spent : Float;
    threshold : Float;
    status : AlertStatus;
  };

  public type SpendingMonitorSettingsView = {
    consentGiven : Bool;
    monitoredCategories : [Text];
    thresholds : [(Text, Float)];
  };

  // Internal spending monitor state (mutable thresholds map stored separately)
  type SpendingMonitorInternal = {
    consentGiven : Bool;
    monitoredCategories : List.List<Text>;
    thresholds : Map.Map<Text, Float>;
  };

  // ── State ──────────────────────────────────────────────────────────────────

  let accessControlState = AccessControl.initState();
  var nextId : Nat = 0;
  var anthropicApiKey : Text = "";

  let expenses        = Map.empty<Principal, List.List<Expense>>();
  let chatHistory     = Map.empty<Principal, List.List<ChatEntry>>();
  let userProfiles    = Map.empty<Principal, UserProfile>();
  let userThemes      = Map.empty<Principal, ThemePreference>();
  let documents       = Map.empty<Principal, List.List<DocumentMeta>>();
  let spendingMonitor = Map.empty<Principal, SpendingMonitorInternal>();

  // ── Mixins ─────────────────────────────────────────────────────────────────

  include MixinAuthorization(accessControlState);
  include MixinObjectStorage();

  // ── Helpers ────────────────────────────────────────────────────────────────

  func nextNatId() : Nat {
    let id = nextId;
    nextId += 1;
    id
  };

  func requireAuth(caller : Principal) {
    if (not AccessControl.hasPermission(accessControlState, caller, #guest)) {
      Runtime.trap("Unauthorized");
    };
  };

  func categoryToText(cat : ExpenseCategory) : Text {
    switch cat {
      case (#Food)          "Food";
      case (#Shopping)      "Shopping";
      case (#Transport)     "Transport";
      case (#Bills)         "Bills";
      case (#Entertainment) "Entertainment";
      case (#Health)        "Health";
      case (#Travel)        "Travel";
      case (#Other)         "Other";
    }
  };

  // Derive a simple month key "YYYY-MM" from a date string "YYYY-MM-DD"
  func monthKey(date : Text) : Text {
    if (date.size() >= 7) {
      Text.fromIter(date.toIter().take(7))
    } else { date }
  };

  // Current month key from Time.now() (best-effort: returns approximate YYYY-MM)
  func currentMonthKey() : Text {
    // Time.now() is nanoseconds since epoch.
    // We approximate: divide to seconds, then days, then months.
    let nowNs : Int = Time.now();
    let nowSec = nowNs / 1_000_000_000;
    let daysSinceEpoch = nowSec / 86400;
    // Rough calendar approximation
    let year400 = (daysSinceEpoch * 400 + 97) / 146097;
    let approxYear = 1970 + year400;
    let approxMonth = ((nowSec / 2629800) % 12) + 1; // ~1 month in seconds
    let y = approxYear.toText();
    let m = if (approxMonth < 10) { "0" # approxMonth.toText() } else { approxMonth.toText() };
    y # "-" # m
  };

  // ── Expense CRUD ───────────────────────────────────────────────────────────

  public shared ({ caller }) func addExpense(input : ExpenseInput) : async Expense {
    requireAuth(caller);
    let expense : Expense = {
      id            = nextNatId();
      amount        = input.amount;
      merchant      = input.merchant;
      date          = input.date;
      category      = input.category;
      paymentMethod = input.paymentMethod;
      note          = input.note;
      source        = input.source;
      createdAt     = Time.now();
      updatedAt     = null;
      callerId      = caller;
    };
    switch (expenses.get(caller)) {
      case null {
        let lst = List.empty<Expense>();
        lst.add(expense);
        expenses.add(caller, lst);
      };
      case (?lst) { lst.add(expense) };
    };
    expense
  };

  public query ({ caller }) func listExpenses() : async [Expense] {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null    { [] };
      case (?lst)  { lst.toArray() };
    }
  };

  public shared ({ caller }) func updateExpense(id : Nat, input : ExpenseUpdateInput) : async Bool {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { false };
      case (?lst) {
        var found = false;
        lst.mapInPlace(func (e) {
          if (e.id == id) {
            found := true;
            {
              e with
              amount        = switch (input.amount)        { case (?v) v;  case null e.amount        };
              merchant      = switch (input.merchant)      { case (?v) v;  case null e.merchant      };
              date          = switch (input.date)          { case (?v) v;  case null e.date          };
              category      = switch (input.category)      { case (?v) v;  case null e.category      };
              paymentMethod = switch (input.paymentMethod) { case (?v) v;  case null e.paymentMethod };
              note          = switch (input.note)          { case (?v) v;  case null e.note          };
              updatedAt     = ?Time.now();
            }
          } else { e }
        });
        found
      };
    }
  };

  public shared ({ caller }) func deleteExpense(id : Nat) : async Bool {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { false };
      case (?lst) {
        let before = lst.size();
        let filtered = lst.filter(func (e) { e.id != id });
        lst.clear();
        lst.append(filtered);
        lst.size() < before
      };
    }
  };

  public query ({ caller }) func getExpenseSummary() : async ExpenseSummary {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null {
        { total = 0.0; count = 0; thisMonthTotal = 0.0; thisMonthCount = 0; topCategory = "None"; avgExpense = 0.0 }
      };
      case (?lst) {
        let arr = lst.toArray();
        let total   = arr.foldLeft(0.0 : Float, func (acc : Float, e) { acc + e.amount });
        let count   = arr.size();
        let curMon  = currentMonthKey();
        let thisMonth = arr.filter(func (e) { monthKey(e.date) == curMon });
        let thisMonthTotal = thisMonth.foldLeft(0.0 : Float, func (acc : Float, e) { acc + e.amount });
        let thisMonthCount = thisMonth.size();
        let avgExpense = if (count == 0) { 0.0 } else { total / count.toFloat() };

        // Find top category by total spend
        let catMap = Map.empty<Text, Float>();
        for (e in arr.values()) {
          let k = categoryToText(e.category);
          switch (catMap.get(k)) {
            case null    { catMap.add(k, e.amount) };
            case (?prev) { catMap.add(k, prev + e.amount) };
          };
        };
        var topCatName = "None";
        var topCatAmt  = 0.0;
        for ((k, v) in catMap.entries()) {
          if (v > topCatAmt) { topCatName := k; topCatAmt := v };
        };

        {
          total;
          count;
          thisMonthTotal;
          thisMonthCount;
          topCategory  = topCatName;
          avgExpense;
        }
      };
    }
  };

  public query ({ caller }) func getCategoryStats() : async [(Text, Float)] {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { [] };
      case (?lst) {
        let catMap = Map.empty<Text, Float>();
        for (e in lst.values()) {
          let k = categoryToText(e.category);
          switch (catMap.get(k)) {
            case null    { catMap.add(k, e.amount) };
            case (?prev) { catMap.add(k, prev + e.amount) };
          };
        };
        catMap.toArray()
      };
    }
  };

  // ── Chat History ───────────────────────────────────────────────────────────

  public shared ({ caller }) func addChatMessage(input : ChatEntryInput) : async () {
    requireAuth(caller);
    let entry : ChatEntry = {
      id        = nextNatId();
      role      = input.role;
      content   = input.content;
      timestamp = Time.now();
      callerId  = caller;
    };
    switch (chatHistory.get(caller)) {
      case null {
        let lst = List.empty<ChatEntry>();
        lst.add(entry);
        chatHistory.add(caller, lst);
      };
      case (?lst) {
        lst.add(entry);
        // Keep at most 50 messages
        if (lst.size() > 50) {
          let trimmed = lst.filter(func (_) { true });
          let drop = trimmed.size() - 50;
          lst.clear();
          let arr = trimmed.toArray();
          var i = drop;
          while (i < arr.size()) {
            lst.add(arr[i]);
            i += 1;
          };
        };
      };
    };
  };

  public query ({ caller }) func getChatHistory() : async [ChatEntry] {
    requireAuth(caller);
    switch (chatHistory.get(caller)) {
      case null   { [] };
      case (?lst) { lst.toArray() };
    }
  };

  public shared ({ caller }) func clearChatHistory() : async () {
    requireAuth(caller);
    chatHistory.remove(caller);
  };

  // ── AI Assistant ───────────────────────────────────────────────────────────

  // Transform function required by the http-outcalls library
  public query func transformHttpResponse(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input)
  };

  func jsonEscapeString(t : Text) : Text {
    let escaped = t
      .replace(#text "\\", "\\\\")
      .replace(#text "\"", "\\\"")
      .replace(#text "\n", "\\n")
      .replace(#text "\r", "\\r")
      .replace(#text "\t", "\\t");
    "\"" # escaped # "\""
  };

  func buildMessagesArray(chatHistoryJson : Text, userMessage : Text) : Text {
    let trimmed = chatHistoryJson.trimStart(#text " ").trimEnd(#text " ");
    let userMsg = "{\"role\":\"user\",\"content\":" # jsonEscapeString(userMessage) # "}";
    if (trimmed.size() <= 2 or trimmed == "null") {
      "[" # userMsg # "]"
    } else {
      let withoutClose = switch (trimmed.stripEnd(#text "]")) {
        case (?s)  { s };
        case null  { trimmed };
      };
      withoutClose # "," # userMsg # "]"
    }
  };

  func findSubstring(haystack : Text, needle : Text) : ?Nat {
    let h    = haystack.toArray();
    let n    = needle.toArray();
    let hLen = h.size();
    let nLen = n.size();
    if (nLen == 0) { return ?0 };
    if (nLen > hLen) { return null };
    var i = 0;
    label searchLoop while (i + nLen <= hLen) {
      var j     = 0;
      var match = true;
      label matchLoop while (j < nLen) {
        if (h[i + j] != n[j]) { match := false; break matchLoop };
        j += 1;
      };
      if (match) { return ?i };
      i += 1;
    };
    null
  };

  func extractClaudeResponseText(responseJson : Text) : ?Text {
    let needle = "\"text\":\"";
    switch (findSubstring(responseJson, needle)) {
      case null { null };
      case (?startIdx) {
        let afterNeedle = startIdx + needle.size();
        let chars = responseJson.toArray();
        if (afterNeedle >= chars.size()) { return null };
        var i       = afterNeedle;
        var result  = "";
        var escaped = false;
        label extractLoop while (i < chars.size()) {
          let c     = chars[i];
          let cText = Text.fromChar(c);
          if (escaped) {
            if      (cText == "n") { result := result # "\n" }
            else if (cText == "r") { result := result # "\r" }
            else if (cText == "t") { result := result # "\t" }
            else                   { result := result # cText };
            escaped := false;
          } else if (cText == "\\") {
            escaped := true;
          } else if (cText == "\"") {
            break extractLoop;
          } else {
            result := result # cText;
          };
          i += 1;
        };
        ?result
      };
    }
  };

  public shared ({ caller }) func getAIResponse(userMessage : Text, expenseContext : Text) : async Text {
    requireAuth(caller);
    if (anthropicApiKey.size() == 0) {
      return "I am not fully configured yet. Please ask the app administrator to set up the AI assistant.";
    };
    let systemPrompt = "You are ASHH, an expert AI financial assistant for ExpenseLeak AI, a personal expense tracking app used by Indians. Finance-only scope. Respond in 2-4 sentences. Use Indian currency context (rupees, lakhs). End with one actionable tip. Decline non-finance questions politely. User expense context: " # expenseContext;
    let body = "{\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":1000,\"system\":" # jsonEscapeString(systemPrompt) # ",\"messages\":[{\"role\":\"user\",\"content\":" # jsonEscapeString(userMessage) # "}]}";
    let headers : [Outcall.Header] = [
      { name = "Content-Type";      value = "application/json" },
      { name = "x-api-key";         value = anthropicApiKey    },
      { name = "anthropic-version"; value = "2023-06-01"       },
    ];
    let responseJson = try {
      await Outcall.httpPostRequest("https://api.anthropic.com/v1/messages", headers, body, transformHttpResponse)
    } catch (_) {
      return "I am having trouble connecting right now. Please try again in a moment.";
    };
    switch (extractClaudeResponseText(responseJson)) {
      case (?text) { text };
      case null    { "I am having trouble connecting right now. Please try again in a moment." };
    }
  };

  public shared ({ caller }) func chatAssistant(request : ChatRequest) : async ChatResponse {
    requireAuth(caller);
    let response = await getAIResponse(request.message, request.context);
    { response; timestamp = Time.now() }
  };

  // Admin: set Anthropic API key
  public shared ({ caller }) func setAnthropicApiKey(key : Text) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Admins only");
    };
    anthropicApiKey := key;
  };

  // ── Insights ───────────────────────────────────────────────────────────────

  public query ({ caller }) func generateInsights() : async [Text] {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { ["Add your first expense to get personalised insights!"] };
      case (?lst) {
        let arr = lst.toArray();
        if (arr.size() == 0) {
          return ["Add your first expense to get personalised insights!"];
        };

        let catMap = Map.empty<Text, Float>();
        let total  = arr.foldLeft(0.0 : Float, func (acc : Float, e) {
          let k = categoryToText(e.category);
          switch (catMap.get(k)) {
            case null    { catMap.add(k, e.amount) };
            case (?prev) { catMap.add(k, prev + e.amount) };
          };
          acc + e.amount
        });

        var topCatName2 = "None";
        var topCatAmt2  = 0.0;
        for ((k, v) in catMap.entries()) {
          if (v > topCatAmt2) { topCatName2 := k; topCatAmt2 := v };
        };
        let avgPct = if (total > 0.0) { (topCatAmt2 / total) * 100.0 } else { 0.0 };
        let pctText = avgPct.toText();

        [
          "Your top spending category is " # topCatName2 # " at " # pctText # "% of total spend. Consider setting a budget limit for this category.",
          "Track every small expense — they add up quickly. Use the receipt scanner to capture bills on the go.",
          "Set up the Spending Monitor to get alerts when you approach your category limits.",
          "Review your last 30 days of expenses to identify any recurring subscriptions you may no longer need.",
        ]
      };
    }
  };

  public query ({ caller }) func getRiskLevel() : async RiskLevel {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { #Low };
      case (?lst) {
        let arr = lst.toArray();
        if (arr.size() == 0) { return #Low };
        // ABRO heuristic: frequency + high-spend categories
        let curMon       = currentMonthKey();
        let thisMonth    = arr.filter(func (e) { monthKey(e.date) == curMon });
        let monthlyTotal = thisMonth.foldLeft(0.0 : Float, func (acc : Float, e) { acc + e.amount });
        let txCount      = thisMonth.size();
        // Simple thresholds (INR context)
        if (monthlyTotal > 50000.0 or txCount > 60) { #High }
        else if (monthlyTotal > 20000.0 or txCount > 30) { #Medium }
        else { #Low }
      };
    }
  };

  public query ({ caller }) func getSpendingPersonality() : async Text {
    requireAuth(caller);
    switch (expenses.get(caller)) {
      case null { "New Saver" };
      case (?lst) {
        let arr = lst.toArray();
        if (arr.size() < 3) { return "New Saver" };

        let catMap = Map.empty<Text, Float>();
        let total  = arr.foldLeft(0.0 : Float, func (acc : Float, e) {
          let k = categoryToText(e.category);
          switch (catMap.get(k)) {
            case null    { catMap.add(k, e.amount) };
            case (?prev) { catMap.add(k, prev + e.amount) };
          };
          acc + e.amount
        });

        var topCatAmt3 = 0.0;
        for ((_, v) in catMap.entries()) {
          if (v > topCatAmt3) { topCatAmt3 := v };
        };
        let topPct = if (total > 0.0) { topCatAmt3 / total } else { 0.0 };

        if (topPct > 0.6)           { "Impulsive Spender" }
        else if (topPct > 0.4)      { "Category-Focused Spender" }
        else if (arr.size() > 50)   { "Frequent Buyer" }
        else if (total < 5000.0)    { "Budget-Conscious" }
        else                        { "Balanced Spender" }
      };
    }
  };

  public query ({ caller }) func getBudgetStatus() : async BudgetStatus {
    requireAuth(caller);
    let budget = switch (userProfiles.get(caller)) {
      case null    { 20000.0 }; // default
      case (?prof) { prof.monthlyBudget };
    };
    let spent = switch (expenses.get(caller)) {
      case null    { 0.0 };
      case (?lst)  {
        let curMon = currentMonthKey();
        lst.foldLeft(0.0 : Float, func (acc : Float, e) {
          if (monthKey(e.date) == curMon) { acc + e.amount } else { acc }
        })
      };
    };
    let remaining  = if (budget > spent) { budget - spent } else { 0.0 };
    let percentage = if (budget > 0.0)   { (spent / budget) * 100.0 } else { 0.0 };
    { budget; spent; remaining; percentage }
  };

  // ── Document Storage ───────────────────────────────────────────────────────

  public shared ({ caller }) func uploadDocument(meta : DocumentMetaInput) : async DocumentMeta {
    requireAuth(caller);
    let doc : DocumentMeta = {
      id         = nextNatId();
      name       = meta.name;
      fileType   = meta.fileType;
      uploadedAt = Time.now();
      size       = meta.size;
      callerId   = caller;
    };
    switch (documents.get(caller)) {
      case null {
        let lst = List.empty<DocumentMeta>();
        lst.add(doc);
        documents.add(caller, lst);
      };
      case (?lst) { lst.add(doc) };
    };
    doc
  };

  public query ({ caller }) func listDocuments() : async [DocumentMeta] {
    requireAuth(caller);
    switch (documents.get(caller)) {
      case null   { [] };
      case (?lst) { lst.toArray() };
    }
  };

  public shared ({ caller }) func deleteDocument(id : Nat) : async Bool {
    requireAuth(caller);
    switch (documents.get(caller)) {
      case null { false };
      case (?lst) {
        let before   = lst.size();
        let filtered = lst.filter(func (d) { d.id != id });
        lst.clear();
        lst.append(filtered);
        lst.size() < before
      };
    }
  };

  public query ({ caller }) func getDocumentMeta(id : Nat) : async ?DocumentMeta {
    requireAuth(caller);
    switch (documents.get(caller)) {
      case null   { null };
      case (?lst) { lst.find(func (d) { d.id == id }) };
    }
  };

  // ── User Profile ───────────────────────────────────────────────────────────

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfileInput) : async () {
    requireAuth(caller);
    userProfiles.add(caller, profile);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    requireAuth(caller);
    userProfiles.get(caller)
  };

  // ── Theme ──────────────────────────────────────────────────────────────────

  public shared ({ caller }) func saveUserTheme(theme : ThemePreference) : async () {
    requireAuth(caller);
    userThemes.add(caller, theme);
  };

  public query ({ caller }) func getUserTheme() : async ?ThemePreference {
    requireAuth(caller);
    userThemes.get(caller)
  };

  public query func getAllThemeOptions() : async [ThemeOption] {
    [
      { id = "ocean-blue";      name = "Ocean Blue";      description = "Cool blue tones inspired by the deep ocean"       },
      { id = "forest-green";    name = "Forest Green";    description = "Calming greens inspired by nature"                },
      { id = "sunset-orange";   name = "Sunset Orange";   description = "Warm sunset hues for an energetic feel"           },
      { id = "midnight-purple"; name = "Midnight Purple"; description = "Deep purples for a sophisticated look"            },
      { id = "rose-gold";       name = "Rose Gold";       description = "Elegant rose-gold tones"                          },
      { id = "slate-gray";      name = "Slate Gray";      description = "Minimal and professional slate tones"             },
    ]
  };

  // ── Spending Monitor ────────────────────────────────────────────────────────

  public shared ({ caller }) func registerSpendingMonitorConsent(consent : Bool) : async () {
    requireAuth(caller);
    let existing = switch (spendingMonitor.get(caller)) {
      case null {
        {
          consentGiven         = consent;
          monitoredCategories  = List.empty<Text>();
          thresholds           = Map.empty<Text, Float>();
        }
      };
      case (?s) { { s with consentGiven = consent } };
    };
    spendingMonitor.add(caller, existing);
  };

  public query ({ caller }) func getSpendingMonitorSettings() : async SpendingMonitorSettingsView {
    requireAuth(caller);
    switch (spendingMonitor.get(caller)) {
      case null {
        { consentGiven = false; monitoredCategories = []; thresholds = [] }
      };
      case (?s) {
        {
          consentGiven        = s.consentGiven;
          monitoredCategories = s.monitoredCategories.toArray();
          thresholds          = s.thresholds.toArray();
        }
      };
    }
  };

  public shared ({ caller }) func setMonitoredCategories(categories : [Text]) : async () {
    requireAuth(caller);
    let s = switch (spendingMonitor.get(caller)) {
      case null {
        {
          consentGiven        = false;
          monitoredCategories = List.empty<Text>();
          thresholds          = Map.empty<Text, Float>();
        }
      };
      case (?existing) { existing };
    };
    s.monitoredCategories.clear();
    for (cat in categories.values()) {
      s.monitoredCategories.add(cat);
    };
    spendingMonitor.add(caller, s);
  };

  public shared ({ caller }) func setCategoryThreshold(category : Text, threshold : Float) : async () {
    requireAuth(caller);
    let s = switch (spendingMonitor.get(caller)) {
      case null {
        {
          consentGiven        = false;
          monitoredCategories = List.empty<Text>();
          thresholds          = Map.empty<Text, Float>();
        }
      };
      case (?existing) { existing };
    };
    s.thresholds.add(category, threshold);
    spendingMonitor.add(caller, s);
  };

  public query ({ caller }) func checkCategorySpending() : async [SpendingAlert] {
    requireAuth(caller);
    let s = switch (spendingMonitor.get(caller)) {
      case null   { return [] };
      case (?s)   { s };
    };
    if (not s.consentGiven) { return [] };

    let curMon  = currentMonthKey();
    let userExp = switch (expenses.get(caller)) {
      case null   { [] };
      case (?lst) { lst.toArray() };
    };

    let alerts = List.empty<SpendingAlert>();
    for (cat in s.monitoredCategories.values()) {
      let spent = userExp.foldLeft(0.0 : Float, func (acc : Float, e) {
        if (categoryToText(e.category) == cat and monthKey(e.date) == curMon) {
          acc + e.amount
        } else { acc }
      });
      switch (s.thresholds.get(cat)) {
        case null {};
        case (?threshold) {
          let status : AlertStatus = if (spent >= threshold) { #Active } else { #Dismissed };
          alerts.add({ category = cat; spent; threshold; status });
        };
      };
    };
    alerts.toArray()
  };

  public query ({ caller }) func getSpendingAlerts() : async [SpendingAlert] {
    requireAuth(caller);
    let s = switch (spendingMonitor.get(caller)) {
      case null   { return [] };
      case (?s)   { s };
    };
    if (not s.consentGiven) { return [] };

    let curMon  = currentMonthKey();
    let userExp = switch (expenses.get(caller)) {
      case null   { [] };
      case (?lst) { lst.toArray() };
    };

    let alerts = List.empty<SpendingAlert>();
    for (cat in s.monitoredCategories.values()) {
      let spent = userExp.foldLeft(0.0 : Float, func (acc : Float, e) {
        if (categoryToText(e.category) == cat and monthKey(e.date) == curMon) {
          acc + e.amount
        } else { acc }
      });
      switch (s.thresholds.get(cat)) {
        case null {};
        case (?threshold) {
          if (spent >= threshold * 0.8) {
            let status : AlertStatus = if (spent >= threshold) { #Active } else { #Dismissed };
            alerts.add({ category = cat; spent; threshold; status });
          };
        };
      };
    };
    alerts.toArray()
  };
};
