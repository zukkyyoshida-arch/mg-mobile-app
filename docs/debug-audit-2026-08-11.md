# デバッグ監査記録 2026-08-11（ウルトラコード全面調査）

多エージェント調査（検出50件→敵対的検証）の記録。確定した13件は同日の一括修正で対応済み。
ここに残るのは**未検証・未修正の37件**（重要度medium/low）。次回の修正候補リストとして使う。

## 修正済み（2026-08-11・確定13件）

- [high][accounting] C/Fが特別利益（機械売却イ・保険金エ・自動保険金）を営業CFと投資CFで二重計上し、期首現金+totalCF≠期末現金になる（src/utils/calculations.js:623）
- [high][accounting] 広告費（セ）やリスクカード費用（セ/ソ）を1件登録すると期末処理済み扱いになり、給与見積が全消えしてGが跳ね上がる（src/utils/calculations.js:299）
- [high][accounting] 図解（VisualCharts）の製造間接費カードが減価償却を二重計上（NG-5修正の残バグ）（src/components/VisualCharts.jsx:118）
- [high][validation] 1e999入力でNG-9クランプがInfinityを素通し→保存後リロードでアプリ全体が白画面（起動不能が永続化）（src/components/cashledger/AddTransactionModal.jsx:1229）
- [high][validation] 内蔵電卓がNG-9ガードの完全バイパス経路（5/0=でInfinity、10/3=で小数金額がそのまま通る）（src/components/CashLedger.jsx:250）
- [high][validation] リスクカード販売系に在庫・数量上限チェックが皆無：在庫5個でも999,999個販売でき製品在庫が-999,994個・現金+3,200万円に化ける（src/components/cashledger/buildTransactionEntries.js:179）
- [high][sync] DB到達不能時の再参加で「初期化」を選ぶとローカル退避なしで消去され、復帰後にサーバーバックアップも空データで上書きされる（src/App.jsx:835）
- [high][sync] in-flightリクエストの追い越しとリトライのstaleクロージャで、古いスナップショットが新しいサーバーデータを上書きする(バージョンガードなし)（src/App.jsx:212）
- [high][sync] 保存済み認証でのリロード時は同名上書き確認なしで即時upsertされ、古い端末がサーバーの最新データを黙って潰す（src/App.jsx:244）
- [high][state] 借入(オ)+利息(タ)・売掛割引(ア)+手数料(タ)のgroupId欠落による孤児化・二重計上（追加検証で確定）
- [high][state] 第6〜20期が同期・ダッシュボード・アーカイブの集計から欠落（追加検証で確定）
- [high][mobile-ui] リスクカード画面の白地白文字（追加検証で確定）
- [high][mobile-ui] ダッシュボード/アーカイブの375px崩壊（追加検証で確定）

## 未検証・未修正（37件）

### [medium][accounting] 機械売却（イ）で簿価を除却せず売却額全額を特別利益にするため、幽霊簿価が残り続け翌期以降も償却され、自己資本と税額が歪む
対象: src/utils/calculations.js:462
内容: bookEndingMachines（L462）は売却しても簿価を減らさず、extraordinaryGain（L510）はイの入金額全額を利益にする（正しくは売却額−簿価が売却損益で、簿価は資産から除却）。期中のB/Sは両建てで釣り合うが、(1)特別利益が簿価分過大→法人税30%も過大、(2)固定資産と繰越利益剰余金（自己資本＝順位判定の指標）が売却機械の簿価分過大、(3)rollForwardでmachinesValue=prevBS.fixedAssetsが引き継がれ、保有0台になった機械の簿価が翌期以降も20%ずつ償却され続けP/Lを圧迫する。L459-461のコメントは「二重マイナス回避の簡略化」と説明するが、そもそも利益側が簿価を引いていないのが原因。
再現: 数値例で確認済み: 繰越で大型1台・簿価内訳200相当（機械簿価計300）を60万で売却（第2期）→当期償却60（売却済み分も母数に含む）、期末簿価240が翌期へ繰越され、翌期は大型0台なのに償却48が発生。単純例（簿価100の機械を50万で売却・第1期）では特別利益50・税15・剰余金+35となるが、正しくは売却損50・税0のはず。

### [medium][accounting] 期末処理（給与支払）をせずに「前期データを引き継ぐ」と未払費用の負債が消え、翌期以降ずっとB/S不一致が残る
対象: src/App.jsx:362
内容: rollForwardFromPreviousはhasProcessedPeriodEnd（期末処理済みか）を確認せず、prevBS.accruedLaborCost（未払給与・保険料）をnextCarryoverに引き継がない。給与費用は繰越利益剰余金に効いたまま、負債側の未払費用と現金支払だけが消えるため、翌期期首から資産>負債+純資産の恒久的な不一致（🚨バナー）になり、以後の期でも解消されない。確認ダイアログにも警告が無い。
再現: 数値例で確認済み: W2+S1・第2期を期末処理なしで終える→前期末は未払費用99でB/S一致（diff=0）。rollForward相当の引き継ぎ後、翌期期首（ledger空）でdiff=106（未払給与99+未払税7）。期首処理でニ7を納付してもdiff=99が永続する。

### [medium][accounting] 借入返済（ナ）と売掛割引に残高上限バリデーションが無く、超過入力でMath.maxクランプによりB/Sが不一致になる
対象: src/components/cashledger/buildTransactionEntries.js:127
内容: buildFactoring（L125-152）は割引額>0しか見ず売掛残高との比較が無い。buildPeriodOpeningの任意返済（L264-267）と通常カテゴリのナも借入残高チェックが無い。calculations.js側はendingReceivables/endingLoansをMath.max(0,…)で切り上げる（L541/L547）ため、超過分だけ現金流入（または流出）と負債・資産の減少が対応しなくなり、B/S不一致とC/F恒等式の崩れが同時に起きる。NG-9で負数入力は塞がれたが、正数の超過入力は素通り。
再現: 数値例で確認済み: (1)売掛残100に売掛割引200（ア200+タ10）→現金+190に対し売掛は100しか減らず、B/S diff=200、totalCF=90で現金増減190と不一致。(2)借入残50に返済ナ100→現金−100に対し借入は50しか減らず、B/S diff=100。

### [medium][validation] 小数入力が全フォームで素通し：盗難1.5個・採用2.5人・単価12.5万が登録でき、個数/人数トラッキングが非整数に壊れる
対象: src/components/cashledger/AddTransactionModal.jsx:718
内容: NG-9のクランプ `Math.max(0, Number(v)||0)` は負数のみ弾き、小数は通す（step未指定なのでHTML的にも許容）。実証: 盗難数量 "1.5" → SAVED qty=1.5（calculations.js の在庫追跡が1.5個減算）。採用 "2.5"人 → workersHired=2.5・金額12.5万。販売単価（line 1132付近のsalesData price入力）は上限クランプのみで "12.5" が通り salesDetails に小数単価が残る（実証: qty2×12.5=25万）。電卓経由の小数金額（Finding 2）も同根。MGは全て整数（個・人・万）前提の研修ツールのため、非整数が入ると理論値照合（期末棚卸のズレ判定 `matTheoretical === safeMat` など）が恒久的に一致しなくなる。riskQty系（2.5口の広告=12.5万も実証済み）を含め、クランプに Math.floor / step="1" 相当の整数化がない。
再現: ＋→盗難→数量に 1.5 → 追加（エラーなし・qty=1.5保存）。vitest ケースE1/F/H1で SAVED qty=2.5 / qty=1.5 / amount=25(単価12.5) を確認。

### [medium][validation] 期首繰越（設定タブ）の全13入力が無検証：負の資本金・1e999→Infinity が carryover に直接保存され、リロードで全項目が0に化ける
対象: src/components/PriorPeriodCarryover.jsx:18
内容: handleInputChange は `value === '' ? 0 : Number(value)` のみで、負数・小数・1e999（→Infinity）を無検証で onUpdateCarryover に流す。現金・売掛金・借入金・資本金など全フィールド共通。cash=1e999 を入れると calculateFinancials 全体が Infinity 汚染（実証: bookEndingCash=Infinity, totalAssets=Infinity）され、財務三表・借入上限計算（Infinity基準で無限借入可）が全滅する。さらに localStorage 保存時に JSON が Infinity→null 化し、リロード後は `carryover.cash + inflow - outflow` の null 算術で黙って0円になる（実証: JSON roundtrip cash=null）——ユーザーの入力値が警告なしに消えるサイレント破壊。第1期の資本金入力（line 87）は cash を連動計算するため汚染が二重化する。負値（資本金-300等）にもガードがなく、そのまま各計算の前提を壊す。
再現: 設定タブ→期首繰越→⑬現金に 1e999 と入力 → 全画面の残高が∞表示 → リロードすると現金0に化ける。vitest ケースJで bookEndingCash=Infinity / JSON roundtrip null を確認。

### [medium][validation] 期末処理の人数入力が生値保存：マイナス人数が actuals→翌期繰越に伝播し、給与が負値になって利益が水増しされる
対象: src/components/PeriodEndWizard.jsx:499
内容: periodEndWorkers / periodEndSalesmen は `onChange={(e) => setPeriodEndWorkers(e.target.value)}` の生値で、min="0" 属性はスピナーにしか効かない（タイプ・ペーストで -3 が入る）。confirmPeriodEnd は wCount=-3 でも `onUpdateActuals({actualWorkers: -3})` を実行して保存する（給与エントリは `workerSal > 0` ガードで作られないため、負の給与の代わりに「給与ゼロ＋負の人数」という不整合状態になる）。calculations.js:588 は期末処理済みなら `activeWorkers = Number(actuals.actualWorkers)` を無検証で採用するため results.workers=-3 となり、App.jsx:403 の rollForwardFromPrevious で翌期 carryover.workers=-3 に引き継がれ、翌期の推定給与 estimatedWorkerSalary が負値（=固定費が減って利益が水増し）になる。小数人数（2.5人）も同経路で素通し。
再現: 決算タブ→ステップ2→ワーカー数に -3 をタイプ→期末処理を確定→成績・翌期繰越の人員が-3人になり、翌期PLの労務費がマイナス計上される。

### [medium][validation] 期末棚卸の実数入力が負数素通し：実棚 -5 で在庫全量+架空5個分の棚卸ロス取引が生成される
対象: src/components/PeriodEndWizard.jsx:30
内容: handleActualChange は `Number(val)` のみ（min="0" はスピナー限定）。実棚に -5 を入れると diff = 理論値-(-5) = 理論値+5 と過大計算され、handleNextStep の確認を経て confirmPeriodEnd が quantity=理論値+5 の「棚卸ロス」取引を ledger に恒久保存する。calculateFinancials 側は Math.min で実在庫までしかロスを引かないため帳簿上の在庫は0止まりだが、ledger には実態と乖離した過大なロス取引が記録として残り（この研修アプリは記録の照合が主目的）、B/S・PLの特別損失も在庫全額分計上される。1e999 は diff<0 側のアラートで偶然止まるが、負数・小数は通る。
再現: 決算タブ→ステップ1→製品の実数に -5 → 「次へ」→confirm→確定。ledger に quantity=(理論値+5) の 棚卸ロス(製品) が保存される。

### [medium][sync] DB到達不能時は同名重複チェックがスキップされ、復帰後に他参加者のレコードを無警告上書きする
対象: src/App.jsx:856
内容: 参加時に fetchPlayerRecord が非404エラー(M1スリープ=接続不能)だと catch で legacyJoinFlow に直行し(853-859行)、サーバー上の同名レコード有無を確認しないまま commitJoin する。M1復帰後の自動同期は players の (room,player) ユニークupsertなので、既存の別参加者の data と backup をこの端末の内容で無警告に上書きする。同名上書き防止機能がDB障害中は完全に無効化される設計で、復帰後の再チェックも存在しない。
再現: 1) 参加者Xが『鈴木』としてプレイ済み(サーバーにレコードあり) 2) M1スリープ中に別人が『鈴木』で参加→fetchPlayerRecord失敗→legacyJoinFlow→確認なしで参加成立 3) M1復帰→デバウンス同期がgetFirstListItemで既存レコードを発見しupdate→Xのdata/backupが別人のデータで消える。

### [medium][sync] リセット退避(mg_reset_backup)の保存失敗が握り潰され、退避なしでも全消去が続行し取り消しボタンまで表示される
対象: src/App.jsx:317
内容: resetAllData は safeStorage.setItem('mg_reset_backup', …) の成否を確認しない。safeStorage.setItem(20-22行)はQuotaExceededError等を空catchで握り潰すため、保存失敗でも setResetBackupInfo({ts}) で『最後のリセットを取り消す』カードが表示され、全期データの消去が実行される。confirmの文言(314行)は復元可能と約束しているが、実際にはundoLastResetが『取り消せるリセットデータがありません』で終わり、直前のデバウンス同期がサーバーbackupも空データで上書きするため復元手段が消える。localStorageはmg_periods_data+mg_reset_backupで同データを二重保持するため、長期プレイ(20期分の仕訳)では容量逼迫が現実に起こり得る。
再現: 1) localStorage残容量をほぼ使い切った状態(または Safari private mode 相当の書き込み不可環境)で『全データを初期化』をOK 2) 退避は静かに失敗、消去とサーバー上書き同期は成功 3) 設定タブの取り消しボタンを押すと『取り消せるリセットデータがありません』。

### [medium][state] periodsに存在しない期キーへの書き込み/参照でレンダークラッシュ（旧5期版localStorageからの継続ユーザー）
対象: src/App.jsx:302
内容: updatePeriodData(302-310行)は`...prev[currentPeriod]`をガード無しでspreadするため、periods[currentPeriod]が存在しない期ではledgerフィールドだけの部分オブジェクトが生成される。次のレンダーでcurrentData.carryoverがundefinedになり、calculateFinancials(App.jsx:148→calculations.js:133 carryover.materialsCount)がTypeErrorで白画面(main.jsxにルートErrorBoundary無し)。さらに未払税金の自動補完effect(App.jsx:289)は`...prev[currentPeriod].carryover`を直接参照するため、前期に未払税金があると期切替直後のsetPeriods updater内で即クラッシュする。発生条件: 20期対応(2026-05-30 コミット33bba42)以前に保存されたmg_periods_data(キー1〜5のみ)を持つ端末で第6期以降を選択したとき。旧バックアップをサーバー復元(App.jsx:873)した場合も同様。hasExistingData判定(App.jsx:808 periods[1].carryover.capital)もperiods[1]欠損データでは同型のクラッシュになる。
再現: localStorageのmg_periods_dataをキー1〜5のみのJSONに書き換え→アプリ起動→設定タブで6期を選択→(前期未払税金>0なら即クラッシュ / 無くても)出納帳で取引を1件追加した瞬間にTypeErrorで白画面。

### [medium][state] 期首の一括処理を「前期データ引き継ぎ」前に実行するとマーカーだけが記帳され、以後やり直し不能で期首仕訳が永久に欠落する
対象: src/components/cashledger/buildTransactionEntries.js:270
内容: buildPeriodOpeningはcarryoverの売掛・買掛・税金・借入が全て0でも「期首処理」マーカー(270行)を無条件に追加する。CashLedger.jsx:405の期首処理ボタンはマーカーの存在で消え、マーカーはvisibleLedgerから除外される(CashLedger.jsx:268)ため削除も不可能。新しい期に切り替えた直後は出納帳タブに期首処理ボタンが目立つ位置に出る一方、繰越の引き継ぎ(rollForwardFromPrevious)は設定タブの奥にあるため、引き継ぎ前に期首処理を押すと空マーカーだけが残り、後から引き継いでも売掛回収(ア)・買掛支払(ヌ)・納税(ニ)・支払利息(タ)が記帳されないまま当期が進行し、B/S・C/Fが前期末と不整合になる。復旧は個別カテゴリでの手動再入力しかない。
再現: 第1期を売掛・借入ありで終了→設定タブで第2期を選択(引き継ぎボタンは押さない)→出納帳タブの「🌅期首一括処理」を実行(全項目0で確定)→ボタン消滅→その後に設定タブで引き継ぎを実行しても期首仕訳は二度と作成されない。

### [medium][state] 期末処理ウィザードに実行済みガードが無く、再実行で給与・保険料が二重計上される
対象: src/components/PeriodEndWizard.jsx:132
内容: confirmPeriodEndは期首処理のようなマーカーを残さず、確定後もsetCurrentStep(1)でウィザードがStep1から再度実行できる。2回目の確定で労務費(シ)・販売費(セ)・社会保険(ソ)が同額でもう一度追加される(借入返済20%だけはledger集計から残額0になり重複しない)。さらに1回目の確定で投げ売り・棚卸ロスにより理論在庫が減った後なので、保持されたままのactualsとの差分から追加の棚卸ロス(または「理論値より多い」ブロック)が発生し、在庫と特別損失もずれる。App.jsx:479のkey(ledger.length)により確定直後にウィザードがリマウントされてStep1の照合画面が再表示されるため、受講者が再度進めてしまう導線になっている。
再現: 第1期でワーカー2名の状態で期末処理を最後まで確定(シ36万等が記帳)→成績発表を閉じる→期末処理タブは再びStep1→次へ→次へ→確定→シ36万・ソ24万等が2セット目として追加され、P/Lの固定費が倍増する。

### [medium][state] 経営計画表(ManagementPlan)の期判定が常に第1期になり、借入利息の予算が期首処理の実績と食い違う
対象: src/components/ManagementPlan.jsx:80
内容: period導出が`results?.currentPeriod || results?.period || 1`だが、calculateFinancialsの戻り値(calculations.js:690-800付近)にはcurrentPeriodもperiodも含まれないため常に1になる。App.jsxはcurrentPeriodをpropsとして渡していない。結果、(1)calculateBudget(calculations.js:819)の自動計上利息が第4〜5期でも10%で計算される(期首処理の実績はbuildTransactionEntries.js:258で5%)ため計画と実績が構造的に乖離、(2)期別単価テーブル(rates 1〜5)とnonOpRate初期値(118行 period>=4?5:period>=2?10:0→常に0)が全期で第1期の値になる。
再現: 第4期で前期繰越借入200万の状態で計画表を開く→「前期繰越からの自動計上: 支払利息20万」(10%)と表示される。同じ期の期首一括処理は利息10万(5%)を記帳し、予実ギャップに恒常的な+10万の差が出る。

### [medium][state] 同名プレイヤーの2端末同時稼働で同期がlast-writer-winsになり、サーバーのdataとbackupが古い内容に巻き戻る
対象: src/pocketbase.js:14
内容: syncPlayerDataは(room,player)で無条件upsertし、payloadのlastUpdatedを比較しない。参加時の同名上書き確認(App.jsx:861-896)は参加操作時のみ有効で、既に参加済みの旧端末・旧タブはperiods変更のたびに2秒デバウンス+最大3回リトライ(5/15/30秒)で自動送信を続ける。端末Aのタブを開いたまま端末Bで復元して続行すると、Aで何か操作(またはリロード時の初回同期 App.jsx:239-247が無条件push)が起きた時点でBの進行がサーバー上のdata/backupごと旧状態で上書きされ、ダッシュボードの成績が巻き戻り、以後のサーバー復元も古いbackupを返す。
再現: 端末Aで第3期までプレイ→端末Bで同名参加しサーバー復元して第4期まで進める→端末Aのタブをリロード(初回同期effectが即push)→ダッシュボードとplayers.backupが第3期時点に戻る。

### [medium][state] 伝票番号: モーダルのプレビュー番号が実際には採番されない取引種別があり、欠番と裸の「#」表示で突き合わせが崩れる
対象: src/components/cashledger/AddTransactionModal.jsx:111
内容: voucherNoを採番するのはfinalizeCommonEntry・buildProduction・buildGreenChipsのみ。売掛割引(buildTransactionEntries.js:133-150)・リスクカード全種(155-236)・期首処理の各仕訳(240-272)・期末処理ウィザードの全取引(PeriodEndWizard.jsx:141-190)はvoucherNo無しで保存される。一方モーダル上部の「伝票番号(自動連番)」(AddTransactionModal.jsx:111)は売掛割引・リスクカード選択時にも次番号を表示するため、受講者に見せた番号がその取引には付かず、後続の別取引に割り当てられる。番号無し取引はタイムラインで裸の「#」(TimelineList.jsx:41)になる(buildProduction 285-286行のコメントが問題視した状態が他種別に残存)。加えて「直す」(CashLedger.jsx:176-201)は元番号を引き継がず最大+1で再採番するため、修正のたびに欠番が増え番号が付け替わる。既存最大+1方式のため番号の重複(衝突)自体は発生しない。
再現: 取引を4件登録(#1〜#4)→モーダルで売掛割引を選択(プレビュー#5)→登録→ア・タ2件は「#」表示で番号なし→次に材料仕入を登録すると#5が付く。また#2の取引を「直す」で入れ直すと#2は消えて#6になる。

### [medium][mobile-ui] モーダル内の数量ステッパー（-/+）が28×28px、MAXボタンが最小約22×17pxでタップターゲット不足
対象: src/components/cashledger/AddTransactionModal.jsx:773
内容: 研修中に最も高頻度で叩く数量調整ボタンが小さすぎる。市場別材料購入・機械購入/売却・広告・緑チップ・商品販売の各行の -/+ ボタンはすべて width/height 28px 固定（L773,779,843,850,892,898,941,948,1005,1011,1152,1163）。市場行のMAXは実測43×22px（L793）、ラベル内のMAXボタン（L415,480: padding'2px 6px'・fontSize 0.65rem）は約22×17pxでWCAG 2.5.8の最低24pxも下回る。Apple HIGの44×44pt推奨に対し全て不足し、指の太い受講者が隣の-/+を誤タップしやすい。投げ売りチェックボックスも16×16px（L1063、ラベル併用で実効242×23px）。
再現: 375pxでFAB→材料購入(現金)表示。ブラウザ実測: ステッパー14個すべて {w:28,h:28}、MAXボタン {w:43,h:22}。コード上も width:'28px',height:'28px' のインラインstyleが12箇所

### [medium][mobile-ui] 取引履歴の「入力し直す」「削除」ボタンが約26×26pxで6px間隔で隣接（誤タップで削除誘発）
対象: src/components/cashledger/TimelineList.jsx:77
内容: タイムライン各行の右端にあるリドゥボタン（L78-97: padding 4px＋18pxアイコン＝約26×26px）と削除ボタン（L99-107: 同26×26px・opacity 0.4で視認性も低い）が gap 6px で隣接。44px推奨に対し大幅に不足し、金額表示の直隣で誤タップしやすい。削除は window.confirm があるため即時データ喪失には至らないが、確認ダイアログの文言を読まずOKを押す受講者では取引が消える。
再現: コード実測: SVGアイコン width/height 18px ＋ padding 4px ＝ 26×26px、親flexの gap:'6px'（L73）。両ボタンとも min-width/min-height 指定なし

### [medium][mobile-ui] 数値入力欄約50箇所で inputMode/pattern 欠落（iOSでテンキーが出ない・画面間で不統一）
対象: src/components/cashledger/AddTransactionModal.jsx:1190
内容: アプリ全体の type="number" 入力52箇所のうち inputMode 指定があるのは PeriodEndWizard.jsx L497/L529 の2箇所のみ。iOS Safariでは type=number だけだと大型テンキー（数字パッド）ではなく数字段付きフルキーボードが出るため、数量・単価・金額の高速入力に向かない。同じ期末処理ウィザード内でもStep1の棚卸入力（L234/265/296）は inputMode なし、Step2の人数入力（L497/529）はありと不統一。対象: AddTransactionModal.jsx（数量/単価/金額/投げ売り/リスク数量等 約20箇所）、PriorPeriodCarryover.jsx（期首繰越 約17箇所）、ManagementPlan.jsx L200（予算入力 renderInput 経由の全欄）、PeriodEndWizard.jsx L234/265/296/362/715。整数欄には inputMode="numeric"（必要なら pattern="[0-9]*"）の付与が定石。
再現: grep結果: inputMode は src 全体で PeriodEndWizard.jsx の2件のみ。ブラウザでDOM実測でも設定タブ・モーダル内の全 number 入力が inputMode='(none)'

### [low][accounting] 繰越未払税金（carryover.taxes）がB/Sの負債に計上されず、引き継ぎ直後〜期首処理まで不一致バナーが誤表示される
対象: src/utils/calculations.js:561
内容: totalLiabilitiesのunpaidTaxは当期発生分（corporateTax）のみで、前期から繰り越した未払税金carryover.taxesを含まない。正常なフロー（期末処理→引き継ぎ）でも、翌期の期首処理でニを納付するまでの間、B/Sが繰越税額分だけ資産超過になり「🚨貸借対照表が不一致です！計算間違いをチェックして」と受講者の入力ミスを疑うバナーが出る。ニ納付後は現金が減って偶然一致に戻るため、負債に『未払法人税等（前期分）』を出すか案内文の修正が必要。
再現: 数値例で確認済み: 第1期を期末処理まで正しく終え（unpaidTax=7・diff=0）、rollForward相当で引き継ぐ→第2期期首（ledger空）でdiff=7。期首処理（ニ7納付）後にdiff=0へ戻る。繰越税額が大きいほどバナーのズレ金額も大きく出る。

### [low][accounting] C/F画面の営業CF内訳行に「未払費用増減」「法人税納付（ニ）」が無く、表示行の合計が営業CF合計と一致しない
対象: src/components/FinancialStatements.jsx:393
内容: C/Fタブの内訳（┗行）は税引前利益・減価償却・在庫増減・売掛買掛増減の4行のみ。operatingCFの計算（calculations.js L611-620）にはさらにaccruedExpenseChange（NG-3で追加）と−ニ納付額が入っているため、期首処理でニを納付した期や未払費用が動く期は、画面の内訳を足しても営業CF合計に届かない。伝票と決算書を突き合わせる研修用途で受講者が検算できない。なおユニットテスト（calculations.test.js L498「内訳を足すと一致」）もニ抜きの式で再構成しており、この欠落を検出できない。
再現: 数値例で確認済み: 繰越税40をニで納付しただけの第2期→内訳4行の合計=0に対しoperatingCF=−40（差40）。未払費用が増減する期（採用直後など）も同様に差が出る。

### [low][accounting] 借入利息の丸めが経路で不一致（期首処理=Math.round、期中新規借入=Math.floor）
対象: src/components/cashledger/buildTransactionEntries.js:604
内容: 同じ利率でも、繰越借入への期首利息はMath.round（buildPeriodOpening L259、calculateBudget L820も同じ）、期中の新規借入の自動利息はMath.floor（L604）。端数0.5万が出る借入額では同じ残高に対して経路によって利息が1万ずれ、予算（計画）と実績の突き合わせでも差が出る。
再現: 借入45万・第1期（10%）: 期首処理ではround(4.5)=5万、期中借入ではfloor(4.5)=4万。計画（calculateBudget）は5万で見積もるため、期中に45万借りた実績4万と1万ずれる。

### [low][validation] 入金系の金額に上限がなく1e20等の巨大数が登録可能（機械売却Infinityも素通し）：checkCashBalanceは入金側を一切止めない
対象: src/components/cashledger/buildTransactionEntries.js:460
内容: checkCashBalance は「現金が減ってマイナスになる」場合しか止めないため、入金系（機械売却イ・販売キ/ネ・売掛回収ア等）は金額上限が事実上ない。機械売却の売却額に 1e999（クランプ後Infinity）→ SAVED amount=Infinity, bookEndingCash=Infinity を実証（Finding 1のリロード白画面連鎖に接続）。有限の巨大数（1e20万円）でも研修データとして無意味な値がそのまま恒久保存される。借入(オ)だけは純資産×倍率の上限があるのと非対称。
再現: ＋→機械売却(イ)→台数1→売却額に 1e999 → 追加。vitest ケースIで SAVED amount=Infinity / bookEndingCash=Infinity を確認。1e20 など有限巨大数はどの入金系でも素通し。

### [low][validation] 経営計画（予算）の全入力が無検証：負数・小数・Infinityが budget に保存される
対象: src/components/ManagementPlan.jsx:190
内容: handleChange は `value === '' ? 0 : Number(value)` のみ。負の人数・小数・1e999（→Infinity）が scenarios と onUpdateBudget 経由で periods[p].budget に保存される。derivateTotals/calculateBudget は `||0` ガードがあるため画面クラッシュはしないが、必要売上数量 requiredQ などの導出値が負・Infinity になり予実比較表示が壊れる。JSON保存で Infinity→null→次回0に化けるサイレント変質も同様に発生する。
再現: 経営計画タブ→ワーカー人数に -5 や 1e999 を入力。固定費合計が負値/∞表示になり、そのまま budget として保存される。

### [low][validation] 「直す」(redo)が handleCategorySelect を経由しないため、生産(コ/サ)エントリは再登録不能・非現金カテゴリは検証対象外で属性欠落エントリを再作成できる
対象: src/components/CashLedger.jsx:196
内容: handleRedoTransaction は resetForm() 後に setSelectedCategory を直接呼ぶため、handleCategorySelect にあるコ=単価2/サ=単価1のプリセットが入らない。生産で作られたコ/サエントリ（groupId なしの単独エントリ）を「直す」と、単価欄は disabled かつ空 → 金額が常に0 → 「0万円」ブロックで再登録が永久に不可能（元エントリは既に削除済みなので取引が1件消えたままになる）。また 退職 など isCash=false のカテゴリを redo すると finalizeCommonEntry の0円/マイナス検証が丸ごとスキップされ、workersResigned 等の必須属性を持たない裸のエントリが作成できる。入力検証の抜け道として記録。
再現: 生産（投入・完成）を登録→タイムラインの「サ」エントリで「直す」→確認OK（この時点で元エントリ削除）→数量を入れて追加→「0万円の処理は登録できません」→再登録手段がなく取引が失われる。

### [low][sync] mg_reset_backupがroom/playerに紐付いておらず、ルーム移動後の取り消しで旧ルームのデータが新ルームのサーバーレコードに注入される
対象: src/App.jsx:332
内容: 退避スナップショットは periods/currentPeriod/ts のみで、どのルーム・プレイヤーの状態だったかを記録しない。リセット→ルーム変更→別ルームに新規参加した後でも取り消しボタンが表示され続け、undoLastReset を押すと旧ルームのプレイデータが復元され、デバウンス同期で新ルームのプレイヤーレコードとbackupへそのまま書き込まれる。研修運用ではダッシュボード成績の混入(前回研修の成績が新ルームに出現)になる。
再現: 1) ルームAでプレイ→全期リセット(退避作成) 2) ルーム設定を変更しルームBへ新規参加 3) 設定タブ『最後のリセットを取り消す』→ルームAの全期データが復元 4) 2秒後の自動同期でルームBのサーバーレコードにルームAの成績が保存される。

### [low][sync] フルバックアップの対象がperiods/currentPeriodのみで、transactionMode・enableCredit等の設定が復元されない
対象: src/App.jsx:196
内容: generateBackupPayload は periods と currentPeriod だけを保存する。掛け取引モード(mg_transaction_mode)や掛けルール有効フラグ(mg_enable_credit)は復元されず、新端末では復元後に既定値(現金モード/掛け有効)へ戻る。掛け取引モードでプレイ中の参加者が端末を替えて復元すると、次の取引入力が現金扱いになり、以降の帳簿と実際のゲーム操作が食い違う復元不整合が起きる。
再現: 1) 掛け取引モードでプレイし同期 2) 別端末で同名参加し復元 3) 出納帳は掛売の履歴を持つのに取引モードは『現金取引のみ』に戻っている。

### [low][sync] ダッシュボードはDB不達で復旧手段がなく(初回取得リトライなし・SSE再接続後の再取得なし)、ブロッキングalertが2回出る
対象: src/pocketbase.js:81
内容: subscribeToRoom は初回getFullListと購読開始のそれぞれで失敗時にwindow.alertを出すのみでリトライしない(79-82行・106-109行)。dashboard_is_subscribed=trueがlocalStorageに永続化されているため、M1不達中にプロジェクター機を起動すると空画面+alert2連発になり、以後M1が復帰しても手動リロードまで表示されない。またSSEが一時切断された場合、SDKの再接続では切断中のイベントは再配信されず初回getFullListも再実行されないため、切断中に更新したプレイヤーの成績はリロードまで古いまま表示される(取りこぼしの再取得処理がコード上存在しない)。
再現: 1) M1スリープ中にダッシュボードを開く(購読状態は前回から永続化)→alert2回・待機画面のまま 2) M1復帰後も自動回復せず、講師がリロードするまで成績が出ない。

### [low][sync] 『成績を永久保存』に冪等性がなく、confirmを通るたびに同内容のアーカイブが二重保存される
対象: src/components/Dashboard.jsx:206
内容: archiveRoom は毎回新規createで、roomId+日付等での重複チェックや保存中のボタン無効化がない。応答が遅い(M1がスリープから覚醒中)ときに講師が再度押して confirm を通すと、同じルームの総合成績が archives に複数レコード作られる。歴代トップ10(Archives.jsx 28-37行)は全アーカイブをflatMapするため、同一プレイヤーが重複して複数順位を占有し歴代ランキングが崩れる。
再現: 1) ダッシュボードで『成績を永久保存』→応答待ちの間にもう一度押しconfirmをOK 2) archivesに同内容が2件 3) 歴代純資産トップ10に同じプレイヤーが2行並ぶ。

### [low][sync] 旧5期形式のperiodsデータ(復元・旧localStorage)で6期以降に入力すると carryover 未定義で calculateFinancials がTypeError→白画面
対象: src/App.jsx:306
内容: 20期対応(コミット33bba42)以前のmg_periods_dataは1〜5期のキーしか持たず、そのままサーバーbackupにも保存され復元され得る。この状態で設定タブ(TOTAL_PERIODS=20のグリッド)から6期以降を選び取引を1件入力すると、updatePeriodData のスプレッド(303-309行)が undefined から {ledger:[…]} だけのオブジェクトを作り、次レンダーの calculateFinancials(currentData.carryover=undefined) が calculations.js 133行 carryover.materialsCount でTypeError。ルートにErrorBoundaryがない(main.jsx)ため白画面になる。renderが例外を投げるため保存effectは走らず、リロードで入力前の状態に戻る=直前の入力1件が失われる(恒久破損はしない)。
再現: 論証: periods={1..5}のみの状態(旧版localStorage、またはそれを含むサーバーbackupの復元後)→設定タブで6期を選択→出納帳で取引追加→periods[6]={ledger:[entry]}(carryoverなし)→App.jsx 148行の calculateFinancials 呼び出しで carryover.materialsCount 参照によりTypeError→アプリ全体がアンマウントされ白画面。

### [low][state] リセット取り消し(undoLastReset)がtransactionModeを復元せず、掛け取引モードのデータに現金モードで追記される
対象: src/App.jsx:332
内容: resetAllData(313-329行)はスナップショットにperiodsとcurrentPeriodしか退避せず(317行)、transactionModeを'cash'に強制する(326行)。undoLastResetはperiodsとcurrentPeriodのみ復元するため、掛け取引モード('credit')で進行していたデータを復元しても取引モードは'cash'のまま。以後の販売・仕入がキ/ツ(現金)で記帳され、復元前のネ/ノ(掛け)と混在して売掛金・買掛金の残高管理が崩れる。「一度掛け取引を開始すると現金取引には戻せません」というゲームルール(CashLedger.jsx:387)ともUI上矛盾する(解禁バナーが再表示される)。
再現: 第2期で掛け取引モードを開始しネで販売→設定タブで全リセット→「最後のリセットを取り消す」→データは戻るが出納帳に「掛け取引が解禁されました」バナーが再表示され、新規販売が現金売上(キ)として記帳される。

### [low][state] taxPatchedRefがリセット・復元後もクリアされず、2周目プレイで未払税金の自動補完が発火しない
対象: src/App.jsx:271
内容: 未払税金の引き継ぎ漏れを一度だけ自動補完するeffect(271-299行)は期番号キーのuseRefで発火済みを記録するが、resetAllData・undoLastReset・サーバー復元・別ルーム参加時の初期化のいずれもこのrefをクリアしない。同一セッション内でリセットして最初からプレイし直すと、第2期以降に到達しても補完が二度と実行されず(refに"2"等が残存)、引き継ぎボタンを使わない受講者の期首carryover.taxesが0のまま→期首処理で納税(ニ)が作られず前期末B/Sの未払法人税と食い違う。リロードすればrefが消えて復活するため再現が不安定な「たまに直る」型のずれになる。
再現: 第1期を利益ありで終え第2期へ(自動補完が発火しtaxesが入る)→設定タブで全リセット→再度第1期を利益ありで終え第2期へ→今回はcarryover.taxesが0のまま(期首処理にも納税が出ない)。リロード後にやり直すと補完される。

### [low][state] 第6期以降は給与・保険単価が第5期に固定される一方、期数UIは20期まで開放されている（期数管理の設計不整合）
対象: src/utils/calculations.js:121
内容: calculateFinancials(121行)とPeriodEndWizard(111行)・calculateBudget(814行)はperiodKeyをMath.min(5,...)でクランプし、SALARY_TABLE(55-62行)も1〜5期分しか持たない。借入利率(buildTransactionEntries.js:258)はcurrentPeriod>=4判定なので6期以降も5%で整合するが、期選択UI(PriorPeriodCarryover TOTAL_PERIODS=20)とリセット説明「全20期分」に対し、6期以降は第5期の単価・利率・ダッシュボード集計外(別finding)という中途半端な状態。20期対応が期選択グリッドだけに留まっており、5期制の研修設計と20期UIのどちらが正かをコード上で決め切れていない。
再現: 第6期で期末処理Step2を開く→給与単価28万/保険17万(第5期と同値)と表示される。仕様としての明示(クランプのコメントはあるがUI側の注記なし)が無いため、拡張時の混乱要因。

### [low][state] アーカイブ保存はデバウンス同期のスナップショットで最新2秒+リトライ分の取引を取りこぼし、二重保存のガードも無い
対象: src/components/Dashboard.jsx:203
内容: 「💾成績を永久保存」はsubscribeToRoomで受信済みのplayersDataをそのままarchiveRoomに渡す。プレイヤー側は操作から2秒のデバウンス(App.jsx:250-263)+失敗時最大50秒のリトライ後に送信するため、講師が終了直後に保存すると最後の取引(期末処理の給与一括など大きい金額)が反映前のスナップショットで恒久保存される。またarchiveRoomは同一roomIdの既存アーカイブを確認せずcreateするため、ボタン連打や保存し直しで同室の重複レコードが増え、Archives.jsxの歴代トップ10に同一プレイヤーが複数回並ぶ。
再現: 受講者が期末処理を確定した直後(2秒以内)にダッシュボードで永久保存→アーカイブの純資産が給与支払前の値になる。もう一度保存すると同室のアーカイブが2件でき、歴代ランキングに同一人物が2行出る。

### [low][mobile-ui] モーダルの閉じるボタンが32×32px
対象: src/index.css:501
内容: .modal-close が width/height 32px 固定で44px推奨に不足。ボトムシート右上の唯一の明示的な閉じる手段（オーバーレイタップでも閉じるため致命的ではない）。
再現: index.css L501-505 の固定値。ブラウザ実測 {w:32,h:32}

### [low][mobile-ui] viewport meta で user-scalable=no・maximum-scale=1.0（極小フォントと組み合わさり拡大不能）
対象: index.html:6
内容: ピンチズームを禁止しているが、アプリ内には 0.5rem（8px）〜0.65rem の極小テキストが多数ある（CompanyBoardMinimap.jsx L100/104/151/155 の「MD」「材料:」ラベル等、モーダル内の説明 0.65rem）。iOS Safariはこの指定を無視するがAndroid Chromeでは有効で、高齢の研修参加者が文字を拡大できない。アクセシビリティ(WCAG 1.4.4)上も非推奨。
再現: index.html L6: content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"。ミニマップの fontSize:'0.5rem'/'0.55rem' はコード上で確認

### [low][mobile-ui] ボトムシートに overscroll-behavior:contain が無くスクロール連鎖を許容
対象: src/index.css:468
内容: .modal-content（overflow-y:auto）に overscroll-behavior 指定がなく computed 'auto'。モーダル内スクロールが端に達すると背面へ連鎖しうる。現状は出納帳タブの背面（.app-content）が非スクロールでhtml/bodyも overflow:hidden＋overscroll-behavior:none のため実害は限定的だが、背面がスクロール可能になる変更（タイムライン肥大時のレイアウト変化等）で顕在化する構造。防御として .modal-content への overscroll-behavior:contain 追加が定石。
再現: ブラウザ実測: getComputedStyle(.modal-content).overscrollBehaviorY === 'auto'。index.css L468-480 に指定なし

### [low][mobile-ui] 設定のトグルスイッチが44×24px（高さ不足）
対象: src/App.jsx:519
内容: 掛け取引ルールのON/OFFスイッチ（label.switch）が width 44px × height 24px で、タップ可能領域の高さが24pxしかない。誤って隣の説明文をタップしても反応しないため気づきにくい。研修開始時に講師指示で一斉操作する欄なので、паdding拡張かラベル行全体のタップ化が望ましい。
再現: App.jsx L519: style={{ width:'44px', height:'24px' }}。input自体は opacity:0 width:0 でタップ領域はlabelの44×24pxのみ
