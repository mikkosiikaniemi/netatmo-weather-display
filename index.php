<?php

session_start();

date_default_timezone_set('Europe/Helsinki');

if ( false === file_exists( 'config.php' ) ) {
	die( 'Konfiguraatiotiedostoa ei ole olemassa.');
} else {
	// Initialize helper functions
	require_once 'netatmo.php';
}

// If user chose to log out
if ( isset( $_POST['logout'] ) ) {
	logout_netatmo();
}

// If there is no authorization code from Netatmo, or if the session has not been started
if ( ! isset( $_GET['code'] ) || ! isset( $_SESSION ) ) {
	login_netatmo();
}

?>
<!doctype html>
<html class="no-js" lang="">

<head>
	<meta charset="utf-8">
	<meta http-equiv="x-ua-compatible" content="ie=edge">
	<title>Ukkoherranlenkki 4 Netatmo</title>
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chartist/0.11.0/chartist.min.css" integrity="sha256-Te9+aTaL9j0U5PzLhtAHt+SXlgIT8KT9VkyOZn68hak=" crossorigin="anonymous" />
	<link rel="stylesheet" href="netatmo.css">
</head>

<body>

	<div id="timer">Haetaan päiväystä...</div>
	<hr/>

	<?php

	if ( isset( $_SESSION['state'] ) && ( $_SESSION['state'] === $_GET['state'] ) ) :

		if ( ! isset( $_SESSION['access_token'] ) ) {
			get_access_token();
		}

		if( time() > $_SESSION['token_expires'] ) {
			refresh_token();
		}

		//mikrogramma_debug( $_SESSION );

		?>

	<div id="temperatures">
		<?php
			try {
				echo print_temperatures();
			}
			catch ( Exception $e ) {
				echo $e->getMessage();
			}
		 ?>
	</div>

	<form action="<?php echo basename( $_SERVER['PHP_SELF'] ); ?>" method="post">
		<input type="hidden" name="logout" value="true" />
		<button type="submit">Kirjaudu ulos</button>
	</form>

	<?php
		else :
			mikrogramma_debug( $_SESSION );
			echo '<p>Istunnon tila ei täsmää. <a href="' . basename( $_SERVER['PHP_SELF'] ) . '">Kirjaudu uudelleen.</a></p>';
		endif;
	?>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js" integrity="sha256-4iQZ6BVL4qNKlQ27TExEhBN1HFPvAvAMbFavKKosSWQ=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/locale/fi.js" integrity="sha256-G3lMtJlM+YA+tNkLWR2c59bBmCMVO6M1av8v9JZ0wOc=" crossorigin="anonymous"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/chartist/0.11.0/chartist.min.js" integrity="sha256-UzffRueYhyZDw8Cj39UCnnggvBfa1fPcDQ0auvCbvCc=" crossorigin="anonymous"></script>
	<script src="netatmo.js"></script>
</body>
</html>
