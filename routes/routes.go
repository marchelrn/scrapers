package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/handler"
	"github.com/marchelrn/scrapers/middleware"
	"github.com/ulule/limiter/v3"
	mgin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

// SetupRoutes registers all API routes
func SetupRoutes(s *contract.Service) *gin.Engine {
	r := gin.Default()
	cfg := config.Load()

	r.RedirectTrailingSlash = true
	r.SetTrustedProxies(nil)

	rate := limiter.Rate{
		Period: 1 * time.Second,
		Limit:  100,
	}

	store := memory.NewStore()
	instance := limiter.New(store, rate)
	rateLimiter := mgin.NewMiddleware(instance)
	r.Use(rateLimiter)

	r.Use(middleware.CORSMiddleware(cfg))

	controllers := handler.New(s)

	auth := r.Group("/auth")
	{
		auth.POST("/register", controllers.Auth.Register)
		auth.POST("/login", controllers.Auth.Login)
		auth.GET("/me", middleware.AuthMiddleware(s.Auth), controllers.Auth.Me)
	}

	protected := r.Group("")
	protected.Use(middleware.AuthMiddleware(s.Auth))
	{
		// Projects
		projects := protected.Group("/projects")
		{
			projects.GET("", controllers.Project.GetAll)
			projects.POST("", controllers.Project.Create)
			projects.GET("/:id", controllers.Project.GetByID)
			projects.PUT("/:id", controllers.Project.Update)
			projects.DELETE("/:id", controllers.Project.Delete)
		}

		// Websites
		websites := protected.Group("/websites")
		{
			websites.GET("", controllers.Website.GetAll)
			websites.POST("", controllers.Website.Create)
			websites.GET("/:id", controllers.Website.GetByID)
			websites.PUT("/:id", controllers.Website.Update)
			websites.DELETE("/:id", controllers.Website.Delete)
		}

		// Scraping Configs
		configs := protected.Group("/configs")
		{
			configs.GET("", controllers.Config.GetAll)
			configs.POST("", controllers.Config.Create)
			configs.GET("/:id", controllers.Config.GetByID)
			configs.PUT("/:id", controllers.Config.Update)
			configs.DELETE("/:id", controllers.Config.Delete)
		}

		// Schedulers
		schedulers := protected.Group("/schedulers")
		{
			schedulers.GET("", controllers.Scheduler.GetAll)
			schedulers.POST("", controllers.Scheduler.Create)
			schedulers.GET("/:id", controllers.Scheduler.GetByID)
			schedulers.PUT("/:id", controllers.Scheduler.Update)
			schedulers.DELETE("/:id", controllers.Scheduler.Delete)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "scraping-platform",
		})
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "Server is On!",
			"message": "Welcome to Scrapers",
		})
	})

	return r
}
