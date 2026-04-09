import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Principal "mo:core/Principal";

module {

  // ── Old types (inline, from .old/src/backend/main.mo) ──────────────────────

  type OldExpenseCategory = {
    #Food;
    #Entertainment;
    #Transport;
    #Bills;
    #Shopping;
    #Healthcare;
    #Travel;
    #Other;
  };

  type OldPaymentMethod = {
    #Cash;
    #CreditCard;
    #DebitCard;
    #DigitalWallet;
    #BankTransfer;
    #Other;
  };

  type OldExpense = {
    id : Text;
    userId : Principal;
    date : Time.Time; // nanoseconds Int
    amount : Float;
    category : OldExpenseCategory;
    merchant : Text;
    method : OldPaymentMethod;
    note : Text;
  };

  type OldChatEntry = {
    sender : Text;
    message : Text;
    timestamp : Time.Time;
  };

  type OldUserProfile = {
    name : Text;
    email : ?Text;
    currency : ?Text;
  };

  type OldColorTheme = {
    #arcticMist;
    #goldenDusk;
    #mochaRose;
    #sapphireTide;
    #jadeHorizon;
  };

  type OldThemePreference = {
    colorTheme : ?OldColorTheme;
    isDarkMode : Bool;
  };

  type OldSpendingMonitorSettings = {
    userId : Principal;
    monitoredCategories : [OldExpenseCategory];
    thresholds : Map.Map<OldExpenseCategory, Float>;
    optInStatus : Bool;
  };

  type OldDocument = {
    id : Text;
    owner : Principal;
    filename : Text;
    contentType : Text;
    uploadedAt : Time.Time;
    blobHash : Text;
  };

  type OldActor = {
    nextId : Int;
    anthropicApiKey : Text;
    documents : Map.Map<Text, OldDocument>;
    userProfiles : Map.Map<Principal, OldUserProfile>;
    userThemes : Map.Map<Principal, OldThemePreference>;
    expenses : Map.Map<Principal, List.List<OldExpense>>;
    chatHistory : Map.Map<Principal, List.List<OldChatEntry>>;
    spendingMonitorSettings : Map.Map<Principal, OldSpendingMonitorSettings>;
  };

  // ── New types (matching new main.mo) ─────────────────────────────────────────

  type NewExpenseCategory = {
    #Food;
    #Shopping;
    #Transport;
    #Bills;
    #Entertainment;
    #Health;
    #Travel;
    #Other;
  };

  type NewPaymentMethod = {
    #Cash;
    #Card;
    #UPI;
    #NetBanking;
    #Other;
  };

  type NewExpense = {
    id : Nat;
    amount : Float;
    merchant : Text;
    date : Text;
    category : NewExpenseCategory;
    paymentMethod : NewPaymentMethod;
    note : Text;
    source : Text;
    createdAt : Int;
    updatedAt : ?Int;
    callerId : Principal;
  };

  type NewChatEntry = {
    id : Nat;
    role : Text;
    content : Text;
    timestamp : Int;
    callerId : Principal;
  };

  type NewUserProfile = {
    name : Text;
    email : Text;
    monthlyBudget : Float;
    currency : Text;
  };

  type NewThemePreference = {
    palette : Text;
    mode : Text;
    customColor : ?Text;
  };

  type NewDocumentMeta = {
    id : Nat;
    name : Text;
    fileType : Text;
    uploadedAt : Int;
    size : Nat;
    callerId : Principal;
  };

  type NewSpendingMonitorInternal = {
    consentGiven : Bool;
    monitoredCategories : List.List<Text>;
    thresholds : Map.Map<Text, Float>;
  };

  type NewActor = {
    var nextId : Nat;
    anthropicApiKey : Text;
    expenses : Map.Map<Principal, List.List<NewExpense>>;
    chatHistory : Map.Map<Principal, List.List<NewChatEntry>>;
    userProfiles : Map.Map<Principal, NewUserProfile>;
    userThemes : Map.Map<Principal, NewThemePreference>;
    documents : Map.Map<Principal, List.List<NewDocumentMeta>>;
    spendingMonitor : Map.Map<Principal, NewSpendingMonitorInternal>;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  func migrateCategory(old : OldExpenseCategory) : NewExpenseCategory {
    switch old {
      case (#Food)          #Food;
      case (#Entertainment) #Entertainment;
      case (#Transport)     #Transport;
      case (#Bills)         #Bills;
      case (#Shopping)      #Shopping;
      case (#Healthcare)    #Health;
      case (#Travel)        #Travel;
      case (#Other)         #Other;
    }
  };

  func migratePaymentMethod(old : OldPaymentMethod) : NewPaymentMethod {
    switch old {
      case (#Cash)          #Cash;
      case (#CreditCard)    #Card;
      case (#DebitCard)     #Card;
      case (#DigitalWallet) #UPI;
      case (#BankTransfer)  #NetBanking;
      case (#Other)         #Other;
    }
  };

  // Convert nanosecond timestamp to YYYY-MM-DD text
  func nsToDateText(ns : Int) : Text {
    let secs = ns / 1_000_000_000;
    let days = secs / 86400;
    // Rough Gregorian approximation
    let y400 = (days * 400 + 97) / 146097;
    let year = 1970 + y400;
    let monthApprox = ((secs / 2629800) % 12) + 1;
    let dayApprox = ((days % 30) + 1);
    let yText = year.toText();
    let mText = if (monthApprox < 10) { "0" # monthApprox.toText() } else { monthApprox.toText() };
    let dText = if (dayApprox < 10) { "0" # dayApprox.toText() } else { dayApprox.toText() };
    yText # "-" # mText # "-" # dText
  };

  // ── Migration function ────────────────────────────────────────────────────────

  public func run(old : OldActor) : NewActor {
    let newExpenses = Map.empty<Principal, List.List<NewExpense>>();
    var migratedId : Nat = 0;

    for ((principal, oldList) in old.expenses.entries()) {
      let newList = List.empty<NewExpense>();
      for (e in oldList.values()) {
        newList.add({
          id            = migratedId;
          amount        = e.amount;
          merchant      = e.merchant;
          date          = nsToDateText(e.date);
          category      = migrateCategory(e.category);
          paymentMethod = migratePaymentMethod(e.method);
          note          = e.note;
          source        = "migrated";
          createdAt     = e.date;
          updatedAt     = null;
          callerId      = principal;
        });
        migratedId += 1;
      };
      newExpenses.add(principal, newList);
    };

    let newUserProfiles = Map.empty<Principal, NewUserProfile>();
    for ((p, prof) in old.userProfiles.entries()) {
      newUserProfiles.add(p, {
        name          = prof.name;
        email         = switch (prof.email) { case (?e) e; case null "" };
        monthlyBudget = 0.0;
        currency      = switch (prof.currency) { case (?c) c; case null "INR" };
      });
    };

    // chatHistory, documents, spendingMonitor are reset (incompatible shapes)
    let newChatHistory   = Map.empty<Principal, List.List<NewChatEntry>>();
    let newDocuments     = Map.empty<Principal, List.List<NewDocumentMeta>>();
    let newSpendingMonitor = Map.empty<Principal, NewSpendingMonitorInternal>();

    // userThemes: reset (theme structure completely changed)
    let newUserThemes = Map.empty<Principal, NewThemePreference>();

    {
      var nextId      = migratedId;
      anthropicApiKey = old.anthropicApiKey;
      expenses        = newExpenses;
      chatHistory     = newChatHistory;
      userProfiles    = newUserProfiles;
      userThemes      = newUserThemes;
      documents       = newDocuments;
      spendingMonitor = newSpendingMonitor;
    }
  };
};
