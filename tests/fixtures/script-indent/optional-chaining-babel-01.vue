<!--{"parserOptions": {"parser":"babel-eslint"}}-->
<script>
obj
  ?.aaa
  ?.bbb
  ?.ccc;

obj?.
  aaa?.
  bbb?.
  ccc;

obj?.
  [aaa]?.
  [bbb]
  ?.[ccc];

obj?.
  (
    aaa
  )?.
  (
    bbb
  )
  ?.(
    ccc
  )
</script>
